// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {WebAuthn} from "webauthn-sol/WebAuthn.sol";
import {OpenCashDelegate} from "../src/OpenCashDelegate.sol";

contract Target {
    uint256 public value;
    address public lastCaller;
    bool public drained;

    function store(uint256 next) external payable {
        value = next;
        lastCaller = msg.sender;
    }

    function drain() external {
        drained = true;
    }
}

contract OpenCashDelegateTest is Test {
    string constant RP_ID = "terminal.example.xyz";
    uint256 constant OWNER_KEY = 0xA11CE;

    OpenCashDelegate delegate;
    Target target;
    address owner;

    function setUp() public {
        delegate = new OpenCashDelegate();
        target = new Target();
        owner = vm.addr(OWNER_KEY);
    }

    function _sign(bytes32 digest, string memory flags, string memory rpId)
        internal
        returns (WebAuthn.WebAuthnAuth memory auth, uint256 x, uint256 y)
    {
        string[] memory argv = new string[](5);
        argv[0] = "node";
        argv[1] = "test/sign-assertion.mjs";
        argv[2] = vm.toString(digest);
        argv[3] = flags;
        argv[4] = rpId;

        (bytes memory authenticatorData, string memory clientDataJSON, uint256 ci, uint256 ti, uint256 r, uint256 s, uint256 px, uint256 py)
        = abi.decode(vm.ffi(argv), (bytes, string, uint256, uint256, uint256, uint256, uint256, uint256));

        auth = WebAuthn.WebAuthnAuth({
            authenticatorData: authenticatorData,
            clientDataJSON: clientDataJSON,
            challengeIndex: ci,
            typeIndex: ti,
            r: r,
            s: s
        });
        x = px;
        y = py;
    }

    function _initialize(address account) internal {
        (, uint256 x, uint256 y) = _sign(bytes32(0), "05", RP_ID);
        bytes32 rpIdHash = sha256(bytes(RP_ID));
        vm.prank(account);
        OpenCashDelegate(payable(account)).initialize(x, y, rpIdHash);
    }

    function _storeCall(uint256 next) internal view returns (OpenCashDelegate.Call[] memory calls) {
        calls = new OpenCashDelegate.Call[](1);
        calls[0] = OpenCashDelegate.Call({
            to: address(target),
            value: 0,
            data: abi.encodeCall(Target.store, (next))
        });
    }

    function test_ExecutesWithValidPasskeyAssertion() public {
        _initialize(address(delegate));
        OpenCashDelegate.Call[] memory calls = _storeCall(42);

        (WebAuthn.WebAuthnAuth memory auth,,) = _sign(delegate.challenge(calls), "05", RP_ID);

        vm.prank(address(0xBEEF));
        delegate.verifyAndExecute(calls, auth);

        assertEq(target.value(), 42);
        assertEq(delegate.nonce(), 1);
    }

    function test_CallerIsTheAccountNotTheSubmitter() public {
        _initialize(address(delegate));
        OpenCashDelegate.Call[] memory calls = _storeCall(1);

        (WebAuthn.WebAuthnAuth memory auth,,) = _sign(delegate.challenge(calls), "05", RP_ID);

        vm.prank(address(0xBEEF));
        delegate.verifyAndExecute(calls, auth);

        assertEq(target.lastCaller(), address(delegate));
    }

    function test_RevertsOnReplay() public {
        _initialize(address(delegate));
        OpenCashDelegate.Call[] memory calls = _storeCall(7);

        (WebAuthn.WebAuthnAuth memory auth,,) = _sign(delegate.challenge(calls), "05", RP_ID);
        delegate.verifyAndExecute(calls, auth);

        vm.expectRevert(OpenCashDelegate.InvalidSignature.selector);
        delegate.verifyAndExecute(calls, auth);
    }

    function test_RevertsOnWrongRelyingParty() public {
        _initialize(address(delegate));
        OpenCashDelegate.Call[] memory calls = _storeCall(7);

        (WebAuthn.WebAuthnAuth memory auth,,) = _sign(delegate.challenge(calls), "05", "evil.example.com");

        vm.expectRevert(OpenCashDelegate.RelyingPartyMismatch.selector);
        delegate.verifyAndExecute(calls, auth);
    }

    function test_RevertsWithoutUserVerification() public {
        _initialize(address(delegate));
        OpenCashDelegate.Call[] memory calls = _storeCall(7);

        (WebAuthn.WebAuthnAuth memory auth,,) = _sign(delegate.challenge(calls), "01", RP_ID);

        vm.expectRevert(OpenCashDelegate.InvalidSignature.selector);
        delegate.verifyAndExecute(calls, auth);
    }

    function test_InitializeRejectsForeignCaller() public {
        (, uint256 x, uint256 y) = _sign(bytes32(0), "05", RP_ID);
        bytes32 rpIdHash = sha256(bytes(RP_ID));

        vm.prank(address(0xBEEF));
        vm.expectRevert(OpenCashDelegate.NotSelf.selector);
        delegate.initialize(x, y, rpIdHash);
    }

    function test_DelegatedEoaKeepsItsAddressAsCaller() public {
        vm.signAndAttachDelegation(address(delegate), OWNER_KEY);
        _initialize(owner);

        OpenCashDelegate account = OpenCashDelegate(payable(owner));
        OpenCashDelegate.Call[] memory calls = _storeCall(99);

        (WebAuthn.WebAuthnAuth memory auth,,) = _sign(account.challenge(calls), "05", RP_ID);

        vm.prank(address(0xBEEF));
        account.verifyAndExecute(calls, auth);

        assertEq(target.value(), 99);
        assertEq(target.lastCaller(), owner);
        assertGt(owner.code.length, 0);
    }

    uint256 constant SESSION_KEY = 0x5E5510;

    function _authorizeSession(uint64 expiry) internal {
        address[] memory targets = new address[](1);
        bytes4[] memory selectors = new bytes4[](1);
        targets[0] = address(target);
        selectors[0] = Target.store.selector;

        OpenCashDelegate.Call[] memory calls = new OpenCashDelegate.Call[](1);
        calls[0] = OpenCashDelegate.Call({
            to: address(delegate),
            value: 0,
            data: abi.encodeCall(
                OpenCashDelegate.authorizeSession,
                (vm.addr(SESSION_KEY), expiry, targets, selectors)
            )
        });

        (WebAuthn.WebAuthnAuth memory auth,,) = _sign(delegate.challenge(calls), "05", RP_ID);
        delegate.verifyAndExecute(calls, auth);
    }

    function _signSession(OpenCashDelegate.Call[] memory calls) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 sig) = vm.sign(SESSION_KEY, delegate.sessionDigest(calls));
        return abi.encodePacked(r, sig, v);
    }

    function _drainCall() internal view returns (OpenCashDelegate.Call[] memory calls) {
        calls = new OpenCashDelegate.Call[](1);
        calls[0] = OpenCashDelegate.Call({
            to: address(target),
            value: 0,
            data: abi.encodeCall(Target.drain, ())
        });
    }

    function test_SessionKeyExecutesInScope() public {
        _initialize(address(delegate));
        _authorizeSession(uint64(block.timestamp + 1 hours));

        OpenCashDelegate.Call[] memory calls = _storeCall(5);
        vm.prank(address(0xBEEF));
        delegate.executeWithSession(calls, _signSession(calls));

        assertEq(target.value(), 5);
        assertEq(target.lastCaller(), address(delegate));
    }

    function test_SessionKeyCannotWithdraw() public {
        _initialize(address(delegate));
        _authorizeSession(uint64(block.timestamp + 1 hours));

        OpenCashDelegate.Call[] memory calls = _drainCall();
        bytes memory signature = _signSession(calls);

        vm.expectRevert(abi.encodeWithSelector(OpenCashDelegate.CallOutOfScope.selector, 0));
        delegate.executeWithSession(calls, signature);
        assertFalse(target.drained());
    }

    function test_SessionKeyExpires() public {
        _initialize(address(delegate));
        _authorizeSession(uint64(block.timestamp + 1 hours));

        OpenCashDelegate.Call[] memory calls = _storeCall(5);
        bytes memory signature = _signSession(calls);

        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(OpenCashDelegate.SessionExpired.selector);
        delegate.executeWithSession(calls, signature);
    }

    function test_PasskeyRevokesSession() public {
        _initialize(address(delegate));
        _authorizeSession(uint64(block.timestamp + 1 hours));

        OpenCashDelegate.Call[] memory revokeCall = new OpenCashDelegate.Call[](1);
        revokeCall[0] = OpenCashDelegate.Call({
            to: address(delegate),
            value: 0,
            data: abi.encodeCall(OpenCashDelegate.revokeSession, (vm.addr(SESSION_KEY)))
        });
        (WebAuthn.WebAuthnAuth memory auth,,) = _sign(delegate.challenge(revokeCall), "05", RP_ID);
        delegate.verifyAndExecute(revokeCall, auth);

        OpenCashDelegate.Call[] memory calls = _storeCall(5);
        bytes memory signature = _signSession(calls);

        vm.expectRevert(OpenCashDelegate.SessionNotAuthorized.selector);
        delegate.executeWithSession(calls, signature);
    }

    function test_UnknownSessionKeyRejected() public {
        _initialize(address(delegate));

        OpenCashDelegate.Call[] memory calls = _storeCall(5);
        bytes memory signature = _signSession(calls);

        vm.expectRevert(OpenCashDelegate.SessionNotAuthorized.selector);
        delegate.executeWithSession(calls, signature);
    }

    function test_SessionSignatureCannotReplay() public {
        _initialize(address(delegate));
        _authorizeSession(uint64(block.timestamp + 1 hours));

        OpenCashDelegate.Call[] memory calls = _storeCall(5);
        bytes memory signature = _signSession(calls);
        delegate.executeWithSession(calls, signature);

        vm.expectRevert(OpenCashDelegate.SessionNotAuthorized.selector);
        delegate.executeWithSession(calls, signature);
    }

    function test_AuthorizeSessionRejectsForeignCaller() public {
        address[] memory targets = new address[](1);
        bytes4[] memory selectors = new bytes4[](1);
        targets[0] = address(target);
        selectors[0] = Target.store.selector;

        vm.prank(address(0xBEEF));
        vm.expectRevert(OpenCashDelegate.NotSelf.selector);
        delegate.authorizeSession(vm.addr(SESSION_KEY), uint64(block.timestamp + 1 hours), targets, selectors);
    }

    function test_P256PrecompileIsPresent() public {
        (, uint256 x, uint256 y) = _sign(bytes32(0), "05", RP_ID);
        OpenCashDelegate.Call[] memory calls = _storeCall(1);
        (WebAuthn.WebAuthnAuth memory auth,,) = _sign(delegate.challenge(calls), "05", RP_ID);

        bytes32 message = sha256(abi.encodePacked(auth.authenticatorData, sha256(bytes(auth.clientDataJSON))));
        (bool ok, bytes memory ret) = address(0x100).staticcall(abi.encode(message, auth.r, auth.s, x, y));

        assertTrue(ok);
        assertEq(ret.length, 32, "precompile absent - FCL fallback would be used");
        assertEq(abi.decode(ret, (uint256)), 1);
    }

    function test_AccountKeyStillActsWithoutAnyPasskey() public {
        vm.signAndAttachDelegation(address(delegate), OWNER_KEY);
        _initialize(owner);

        vm.prank(owner);
        target.store(1337);

        assertEq(target.value(), 1337);
        assertEq(target.lastCaller(), owner);
        assertEq(OpenCashDelegate(payable(owner)).nonce(), 0);
    }

    function test_DelegatedEoaStillReceivesNative() public {
        vm.signAndAttachDelegation(address(delegate), OWNER_KEY);

        vm.deal(address(0xBEEF), 1 ether);
        vm.prank(address(0xBEEF));
        (bool ok,) = owner.call{value: 1 ether}("");

        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }
}
