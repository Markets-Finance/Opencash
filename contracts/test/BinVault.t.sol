// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {BinVault, IPerplExchange} from "../src/BinVault.sol";
import {MockAUSD} from "./mocks/MockAUSD.sol";
import {MockPerpl} from "./mocks/MockPerpl.sol";

contract BinVaultTest is Test {
    MockAUSD ausd;
    MockPerpl perpl;
    BinVault vault;
    address manager = address(0xA11CE);
    address guardian = address(0x6A4D);
    address alice = address(0xA1);
    address bob = address(0xB0);

    function setUp() public {
        ausd = new MockAUSD();
        perpl = new MockPerpl(ausd);
        uint256[] memory perps = new uint256[](2);
        perps[0] = 16;
        perps[1] = 32;
        vault = new BinVault("Layer ones bin", "bL1", address(ausd), address(perpl), manager, guardian, perps, 300, 2_000, 7 days);
        ausd.mint(alice, 1_000e6);
        ausd.mint(bob, 1_000e6);
        vm.prank(alice);
        ausd.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        ausd.approve(address(vault), type(uint256).max);
    }

    function order(uint256 perpId, uint8 orderType, uint256 leverage) internal pure returns (IPerplExchange.OrderDesc[] memory orders) {
        orders = new IPerplExchange.OrderDesc[](1);
        orders[0].perpId = perpId;
        orders[0].orderType = orderType;
        orders[0].lotLNS = 100;
        orders[0].leverageHdths = leverage;
    }

    function test_fullEpochWithProfitAndFee() public {
        vm.prank(alice);
        vault.deposit(100e6);
        assertEq(vault.balanceOf(alice), 100e6 - 1_000);

        vm.prank(manager);
        vault.startEpoch();
        assertEq(perpl.balance(address(vault)), 100e6);
        assertEq(vault.totalAssets(), 0);

        vm.prank(manager);
        vault.trade(order(16, 0, 300));
        assertEq(perpl.orders(), 1);

        perpl.pnl(address(vault), 10e6);
        vm.prank(manager);
        vault.settle();

        assertEq(vault.totalAssets(), 110e6);
        uint256 feeShares = vault.balanceOf(manager);
        assertGt(feeShares, 0);
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 out = vault.redeem(aliceShares);
        assertApproxEqAbs(out, 108e6, 2_000, "alice keeps 80% of the 10 profit");
    }

    function test_depositsAndRedeemsBlockedWhileOpen() public {
        vm.prank(alice);
        vault.deposit(100e6);
        vm.prank(manager);
        vault.startEpoch();
        vm.prank(bob);
        vm.expectRevert(BinVault.EpochOpen.selector);
        vault.deposit(50e6);
        vm.prank(alice);
        vm.expectRevert(BinVault.EpochOpen.selector);
        vault.redeem(10e6);
    }

    function test_mandateBlocksOtherMarketsAndHighLeverage() public {
        vm.prank(alice);
        vault.deposit(100e6);
        vm.prank(manager);
        vault.startEpoch();
        vm.prank(manager);
        vm.expectRevert(abi.encodeWithSelector(BinVault.PerpNotAllowed.selector, 48));
        vault.trade(order(48, 0, 200));
        vm.prank(manager);
        vm.expectRevert(abi.encodeWithSelector(BinVault.LeverageTooHigh.selector, 500));
        vault.trade(order(16, 1, 500));
        vm.prank(manager);
        vault.trade(order(16, 2, 5000));
    }

    function test_onlyManagerTrades() public {
        vm.prank(alice);
        vault.deposit(100e6);
        vm.prank(manager);
        vault.startEpoch();
        vm.prank(alice);
        vm.expectRevert(BinVault.NotManager.selector);
        vault.trade(order(16, 0, 200));
    }

    function test_cannotSettleWhileNotFlat() public {
        vm.prank(alice);
        vault.deposit(100e6);
        vm.prank(manager);
        vault.startEpoch();
        perpl.setPositions(address(vault), 1 << 16);
        vm.prank(manager);
        vm.expectRevert(BinVault.NotFlat.selector);
        vault.settle();
        perpl.setPositions(address(vault), 0);
        perpl.setLocked(address(vault), 5e6);
        vm.prank(manager);
        vm.expectRevert(BinVault.NotFlat.selector);
        vault.settle();
    }

    function test_anyoneSettlesAfterDeadlineWhenFlat() public {
        vm.prank(alice);
        vault.deposit(100e6);
        vm.prank(manager);
        vault.startEpoch();
        vm.prank(bob);
        vm.expectRevert(BinVault.TooEarly.selector);
        vault.settle();
        vm.warp(block.timestamp + 7 days);
        vm.prank(bob);
        vault.settle();
        assertEq(vault.totalAssets(), 100e6);
        assertFalse(vault.open());
    }

    function test_lossesShareProRataWithoutFee() public {
        vm.prank(alice);
        vault.deposit(100e6);
        vm.prank(bob);
        vault.deposit(100e6);
        vm.prank(manager);
        vault.startEpoch();
        perpl.pnl(address(vault), -20e6);
        vm.prank(manager);
        vault.settle();
        assertEq(vault.balanceOf(manager), 0, "no fee below the high-water mark");
        uint256 aliceShares = vault.balanceOf(alice);
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(alice);
        assertApproxEqAbs(vault.redeem(aliceShares), 90e6, 2_000);
        vm.prank(bob);
        assertApproxEqAbs(vault.redeem(bobShares), 90e6, 2_000);
    }

    function test_lateDepositorBuysAtSettledPrice() public {
        vm.prank(alice);
        vault.deposit(100e6);
        vm.prank(manager);
        vault.startEpoch();
        perpl.pnl(address(vault), 50e6);
        vm.prank(manager);
        vault.settle();
        uint256 price = vault.pricePerShare();
        vm.prank(bob);
        uint256 shares = vault.deposit(100e6);
        assertApproxEqAbs(shares * price / 1e18, 100e6, 2, "bob pays the settled price, no dilution");
    }

    function test_guardianPauseStopsNewEpochsAndTrades() public {
        vm.prank(alice);
        vault.deposit(100e6);
        vm.prank(guardian);
        vault.setPaused(true);
        vm.prank(manager);
        vm.expectRevert(BinVault.IsPaused.selector);
        vault.startEpoch();
        vm.prank(alice);
        vm.expectRevert(BinVault.NotGuardian.selector);
        vault.setPaused(false);
    }

    function test_managerCannotPullFunds() public {
        vm.prank(alice);
        vault.deposit(100e6);
        vm.prank(manager);
        vm.expectRevert();
        vault.redeem(1);
    }

    function test_donationAttackDoesNotZeroOutNextDepositor() public {
        address attacker = address(0xBAD);
        ausd.mint(attacker, 1_000_000e6);
        vm.startPrank(attacker);
        ausd.approve(address(vault), type(uint256).max);
        vm.expectRevert(BinVault.ZeroAmount.selector);
        vault.deposit(1);
        vault.deposit(1e6);
        ausd.transfer(address(vault), 1_000e6);
        vm.stopPrank();
        vm.prank(alice);
        uint256 shares = vault.deposit(100e6);
        assertGt(shares, 0, "victim still receives shares");
        vm.prank(alice);
        uint256 back = vault.redeem(shares);
        assertGt(back, 99e6, "victim loses under 1%");
    }
}
