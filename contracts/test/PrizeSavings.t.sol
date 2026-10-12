// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PrizeSavings} from "../src/PrizeSavings.sol";
import {MockAUSD} from "./mocks/MockAUSD.sol";
import {MockYieldVault} from "./mocks/MockYieldVault.sol";
import {MockRandom} from "./mocks/MockRandom.sol";

contract PrizeSavingsTest is Test {
    MockAUSD ausd;
    MockYieldVault yield_;
    MockRandom random;
    PrizeSavings savings;
    address treasury = address(0x7EA);
    address alice = address(0xA1);
    address bob = address(0xB0);
    uint256 constant WEEK = 7 days;

    function setUp() public {
        vm.warp(1_000_000);
        ausd = new MockAUSD();
        yield_ = new MockYieldVault(ausd);
        random = new MockRandom();
        savings = new PrizeSavings(address(ausd), address(yield_), address(random), treasury, 1_000, WEEK, 1 days);
        for (uint256 i; i < 2; ++i) {
            address user = i == 0 ? alice : bob;
            ausd.mint(user, 10_000e6);
            vm.prank(user);
            ausd.approve(address(savings), type(uint256).max);
        }
    }

    function test_principalAlwaysComesBack() public {
        vm.prank(alice);
        savings.deposit(1_000e6);
        vm.warp(block.timestamp + 3 days);
        vm.prank(alice);
        savings.withdraw(1_000e6);
        assertEq(ausd.balanceOf(alice), 10_000e6);
        assertEq(savings.principalOf(alice), 0);
    }

    function test_ticketsAreTimeWeighted() public {
        vm.prank(alice);
        savings.deposit(100e6);
        vm.warp(savings.start() + WEEK / 2);
        vm.prank(bob);
        savings.deposit(100e6);
        vm.warp(savings.drawEnd(0) + 1);
        assertEq(savings.ticketsOf(alice, 0), 100e6 * WEEK);
        assertEq(savings.ticketsOf(bob, 0), 100e6 * (WEEK / 2));
        assertEq(savings.totalTickets(0), 100e6 * WEEK + 100e6 * (WEEK / 2));
    }

    function test_skippedWeeksCountFully() public {
        vm.prank(alice);
        savings.deposit(100e6);
        vm.warp(savings.drawEnd(3) + 10);
        vm.prank(alice);
        savings.deposit(1e6);
        assertEq(savings.ticketsOf(alice, 1), 100e6 * WEEK);
        assertEq(savings.ticketsOf(alice, 2), 100e6 * WEEK);
        assertEq(savings.totalTickets(2), 100e6 * WEEK);
    }

    function test_drawRulesAndOneWinner() public {
        vm.prank(alice);
        savings.deposit(1_000e6);
        vm.prank(bob);
        savings.deposit(1_000e6);
        yield_.harvest(20e6);

        vm.expectRevert(PrizeSavings.DrawNotOver.selector);
        savings.closeDraw(0);
        vm.warp(savings.drawEnd(0) + 1);
        vm.expectRevert(PrizeSavings.NoRandomness.selector);
        savings.closeDraw(0);
        random.set(0, 0xC0FFEE);
        savings.closeDraw(0);

        (uint256 prize,,,,,) = savings.draws(0);
        assertApproxEqAbs(prize, 18e6, 2, "10% fee to treasury");
        assertApproxEqAbs(ausd.balanceOf(treasury), 2e6, 2);

        savings.enter(0, alice);
        savings.enter(0, bob);
        vm.expectRevert(PrizeSavings.WindowOpen.selector);
        savings.finalize(0);
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(PrizeSavings.WindowClosed.selector);
        savings.enter(0, alice);
        savings.finalize(0);

        (,,, address leader,,) = savings.draws(0);
        assertTrue(leader == alice || leader == bob);
        uint256 aliceGain = ausd.balanceOf(alice) - 9_000e6;
        uint256 bobGain = ausd.balanceOf(bob) - 9_000e6;
        assertApproxEqAbs(aliceGain + bobGain, 18e6, 2, "exactly one prize paid");
        assertTrue(aliceGain == 0 || bobGain == 0, "only one winner");

        vm.prank(alice);
        savings.withdraw(1_000e6);
        vm.prank(bob);
        savings.withdraw(1_000e6);
        assertGe(ausd.balanceOf(alice) + ausd.balanceOf(bob), 20_000e6 + 18e6 - 4, "both principals intact");
    }

    function test_reservedPrizeIsNotCountedTwice() public {
        vm.prank(alice);
        savings.deposit(1_000e6);
        yield_.harvest(10e6);
        vm.warp(savings.drawEnd(0) + 1);
        random.set(0, 1);
        savings.closeDraw(0);
        assertEq(savings.yieldAvailable(), 0, "the closed prize is reserved");
    }

    function test_noTicketsCannotEnter() public {
        vm.prank(alice);
        savings.deposit(1_000e6);
        vm.warp(savings.drawEnd(0) + 1);
        random.set(0, 7);
        savings.closeDraw(0);
        vm.expectRevert(PrizeSavings.NoTickets.selector);
        savings.enter(0, bob);
    }

    function test_winOddsMatchTicketShare() public view {
        uint256 aliceWins;
        uint256 rounds = 2_000;
        for (uint256 r = 1; r <= rounds; ++r) {
            uint256 a = savings.scoreOf(r, alice, 3);
            uint256 b = savings.scoreOf(r, bob, 1);
            if (a < b) ++aliceWins;
        }
        assertApproxEqAbs(aliceWins, 1_500, 80, "3:1 tickets win about 75% of draws");
    }
}
