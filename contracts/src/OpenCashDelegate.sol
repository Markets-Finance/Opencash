// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {WebAuthn} from "webauthn-sol/WebAuthn.sol";

/// @title OpenCashDelegate
/// @notice EIP-7702 delegate that authorises calls with the account owner's
///         passkey, verified on-chain against the P-256 precompile.
/// @dev Deployed once and shared. Storage lives on each delegating EOA.
contract OpenCashDelegate {
    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    struct Session {
        uint64 expiry;
        bool revoked;
    }

    uint256 public passkeyX;
    uint256 public passkeyY;
    bytes32 public rpIdHash;
    uint256 public nonce;

    mapping(address => Session) public sessions;
    mapping(address => mapping(address => mapping(bytes4 => bool))) public sessionScope;

    event Initialized(uint256 passkeyX, uint256 passkeyY, bytes32 rpIdHash);
    event Executed(uint256 indexed nonce, uint256 calls);
    event SessionAuthorized(address indexed key, uint64 expiry);
    event SessionRevoked(address indexed key);

    error NotSelf();
    error AlreadyInitialized();
    error NotInitialized();
    error RelyingPartyMismatch();
    error AuthenticatorDataTooShort();
    error InvalidPasskey();
    error InvalidSignature();
    error CallReverted(uint256 index, bytes reason);
    error SessionExpired();
    error SessionNotAuthorized();
    error CallOutOfScope(uint256 index);
    error ScopeLengthMismatch();
    error CallDataTooShort(uint256 index);

    /// @notice Registers the owner's passkey. Callable only by the account itself,
    ///         which under EIP-7702 means a transaction signed by the account key.
    function initialize(uint256 x, uint256 y, bytes32 rpIdHash_) external {
        if (msg.sender != address(this)) revert NotSelf();
        if (passkeyX != 0 || passkeyY != 0) revert AlreadyInitialized();
        if (x == 0 || y == 0) revert InvalidPasskey();

        passkeyX = x;
        passkeyY = y;
        rpIdHash = rpIdHash_;

        emit Initialized(x, y, rpIdHash_);
    }

    /// @notice Replaces the registered passkey. Callable only through
    ///         {verifyAndExecute}, so the current passkey authorises its own rotation.
    function rotatePasskey(uint256 x, uint256 y) external {
        if (msg.sender != address(this)) revert NotSelf();
        if (x == 0 || y == 0) revert InvalidPasskey();

        passkeyX = x;
        passkeyY = y;

        emit Initialized(x, y, rpIdHash);
    }

    /// @notice Digest the passkey must sign to authorise `calls` at the current nonce.
    function challenge(Call[] calldata calls) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), nonce, calls));
    }

    /// @notice Executes `calls` when `auth` is a valid passkey assertion over
    ///         {challenge}. Anyone may submit; authority comes from the signature,
    ///         so the sender is only paying gas.
    function verifyAndExecute(Call[] calldata calls, WebAuthn.WebAuthnAuth memory auth) external payable {
        uint256 x = passkeyX;
        uint256 y = passkeyY;
        if (x == 0 || y == 0) revert NotInitialized();

        if (auth.authenticatorData.length < 37) revert AuthenticatorDataTooShort();
        if (_relyingPartyIdHash(auth.authenticatorData) != rpIdHash) revert RelyingPartyMismatch();

        if (!WebAuthn.verify(abi.encodePacked(challenge(calls)), true, auth, x, y)) {
            revert InvalidSignature();
        }

        uint256 used = nonce;
        nonce = used + 1;

        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok, bytes memory reason) = calls[i].to.call{value: calls[i].value}(calls[i].data);
            if (!ok) revert CallReverted(i, reason);
        }

        emit Executed(used, calls.length);
    }

    /// @notice Grants a session key the right to make specific calls until `expiry`.
    ///         Reachable only through {verifyAndExecute}, so the passkey authorises it.
    function authorizeSession(
        address key,
        uint64 expiry,
        address[] calldata targets,
        bytes4[] calldata selectors
    ) external {
        if (msg.sender != address(this)) revert NotSelf();
        if (targets.length != selectors.length) revert ScopeLengthMismatch();

        sessions[key] = Session({expiry: expiry, revoked: false});
        for (uint256 i = 0; i < targets.length; i++) {
            sessionScope[key][targets[i]][selectors[i]] = true;
        }

        emit SessionAuthorized(key, expiry);
    }

    /// @notice Permanently disables a session key. Reachable only through {verifyAndExecute}.
    function revokeSession(address key) external {
        if (msg.sender != address(this)) revert NotSelf();

        sessions[key].revoked = true;

        emit SessionRevoked(key);
    }

    /// @notice Digest a session key must sign to authorise `calls` at the current nonce.
    function sessionDigest(Call[] calldata calls) public view returns (bytes32) {
        return keccak256(abi.encode("opencash.session.v1", block.chainid, address(this), nonce, calls));
    }

    /// @notice Executes `calls` signed by an authorised session key. Every call must
    ///         be inside the scope granted to that key, so a leaked key cannot withdraw.
    function executeWithSession(Call[] calldata calls, bytes calldata signature) external {
        address key = _recover(sessionDigest(calls), signature);

        Session memory session = sessions[key];
        if (session.expiry == 0 || session.revoked) revert SessionNotAuthorized();
        if (block.timestamp >= session.expiry) revert SessionExpired();

        for (uint256 i = 0; i < calls.length; i++) {
            if (calls[i].data.length < 4) revert CallDataTooShort(i);
            if (!sessionScope[key][calls[i].to][bytes4(calls[i].data[:4])]) {
                revert CallOutOfScope(i);
            }
        }

        uint256 used = nonce;
        nonce = used + 1;

        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok, bytes memory reason) = calls[i].to.call{value: calls[i].value}(calls[i].data);
            if (!ok) revert CallReverted(i, reason);
        }

        emit Executed(used, calls.length);
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();

        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);

        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidSignature();
        }

        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
        return signer;
    }

    function _relyingPartyIdHash(bytes memory authenticatorData) private pure returns (bytes32 hash) {
        assembly {
            hash := mload(add(authenticatorData, 0x20))
        }
    }

    receive() external payable {}
}
