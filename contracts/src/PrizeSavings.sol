// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";

interface IYieldVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function balanceOf(address owner) external view returns (uint256 shares);
}

interface IRandomSource {
    function randomness(uint256 drawId) external view returns (uint256);
}

/// No-loss prize savings.
contract PrizeSavings is ReentrancyGuard {
    struct Holder {
        uint256 principal;
        uint256 lastTouch;
        uint256 drawId;
        uint256 accrued;
    }

    struct Draw {
        uint256 prize;
        uint256 randomness;
        uint256 closedAt;
        address leader;
        uint256 leaderScore;
        bool finalized;
    }

    uint256 internal constant BPS = 10_000;

    address public immutable asset;
    IYieldVault public immutable yieldVault;
    IRandomSource public immutable randomSource;
    address public immutable treasury;
    uint256 public immutable feeBps;
    uint256 public immutable start;
    uint256 public immutable period;
    uint256 public immutable claimWindow;

    uint256 public totalPrincipal;
    uint256 public reservedPrizes;
    Holder internal total;
    mapping(address => Holder) internal holders;
    mapping(uint256 drawId => mapping(address => uint256)) internal settledTickets;
    mapping(uint256 drawId => uint256) internal settledTotal;
    mapping(uint256 drawId => Draw) public draws;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event DrawClosed(uint256 indexed drawId, uint256 prize, uint256 randomness);
    event Entered(uint256 indexed drawId, address indexed user, uint256 score);
    event Awarded(uint256 indexed drawId, address indexed winner, uint256 prize);

    error ZeroAmount();
    error TooMuch();
    error DrawNotOver();
    error AlreadyClosed();
    error NotClosed();
    error NoRandomness();
    error WindowClosed();
    error WindowOpen();
    error NoTickets();

    constructor(address asset_, address yieldVault_, address randomSource_, address treasury_, uint256 feeBps_, uint256 period_, uint256 claimWindow_) {
        require(feeBps_ <= 2_000, "fee above 20%");
        asset = asset_;
        yieldVault = IYieldVault(yieldVault_);
        randomSource = IRandomSource(randomSource_);
        treasury = treasury_;
        feeBps = feeBps_;
        period = period_;
        claimWindow = claimWindow_;
        start = block.timestamp;
    }

    function currentDraw() public view returns (uint256) {
        return (block.timestamp - start) / period;
    }

    function drawEnd(uint256 drawId) public view returns (uint256) {
        return start + (drawId + 1) * period;
    }

    function principalOf(address user) external view returns (uint256) {
        return holders[user].principal;
    }

    function ticketsOf(address user, uint256 drawId) public view returns (uint256) {
        return _ticketsAt(holders[user], settledTickets[drawId][user], drawId);
    }

    function totalTickets(uint256 drawId) public view returns (uint256) {
        return _ticketsAt(total, settledTotal[drawId], drawId);
    }

    function yieldAvailable() public view returns (uint256) {
        uint256 held = yieldVault.convertToAssets(yieldVault.balanceOf(address(this)));
        uint256 owed = totalPrincipal + reservedPrizes;
        return held > owed ? held - owed : 0;
    }

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _touch(msg.sender);
        holders[msg.sender].principal += amount;
        total.principal += amount;
        totalPrincipal += amount;
        SafeTransferLib.safeTransferFrom(asset, msg.sender, address(this), amount);
        SafeTransferLib.safeApprove(asset, address(yieldVault), amount);
        yieldVault.deposit(amount, address(this));
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Holder storage holder = holders[msg.sender];
        if (amount > holder.principal) revert TooMuch();
        _touch(msg.sender);
        holder.principal -= amount;
        total.principal -= amount;
        totalPrincipal -= amount;
        yieldVault.withdraw(amount, msg.sender, address(this));
        emit Withdrawn(msg.sender, amount);
    }

    function closeDraw(uint256 drawId) external nonReentrant {
        if (block.timestamp < drawEnd(drawId)) revert DrawNotOver();
        Draw storage draw = draws[drawId];
        if (draw.closedAt != 0) revert AlreadyClosed();
        uint256 random = randomSource.randomness(drawId);
        if (random == 0) revert NoRandomness();
        uint256 gross = yieldAvailable();
        uint256 fee = FixedPointMathLib.fullMulDiv(gross, feeBps, BPS);
        if (fee != 0) yieldVault.withdraw(fee, treasury, address(this));
        draw.prize = gross - fee;
        draw.randomness = random;
        draw.closedAt = block.timestamp;
        draw.leaderScore = type(uint256).max;
        reservedPrizes += draw.prize;
        emit DrawClosed(drawId, draw.prize, random);
    }

    function enter(uint256 drawId, address user) external {
        Draw storage draw = draws[drawId];
        if (draw.closedAt == 0) revert NotClosed();
        if (block.timestamp > draw.closedAt + claimWindow) revert WindowClosed();
        uint256 tickets = ticketsOf(user, drawId);
        if (tickets == 0) revert NoTickets();
        uint256 score = scoreOf(draw.randomness, user, tickets);
        if (score < draw.leaderScore) {
            draw.leaderScore = score;
            draw.leader = user;
        }
        emit Entered(drawId, user, score);
    }

    function finalize(uint256 drawId) external nonReentrant {
        Draw storage draw = draws[drawId];
        if (draw.closedAt == 0) revert NotClosed();
        if (block.timestamp <= draw.closedAt + claimWindow) revert WindowOpen();
        if (draw.finalized) revert AlreadyClosed();
        draw.finalized = true;
        reservedPrizes -= draw.prize;
        if (draw.leader == address(0) || draw.prize == 0) return;
        yieldVault.withdraw(draw.prize, draw.leader, address(this));
        emit Awarded(drawId, draw.leader, draw.prize);
    }

    function scoreOf(uint256 randomness, address user, uint256 tickets) public pure returns (uint256) {
        uint256 u = (uint256(keccak256(abi.encode(randomness, user))) % 1e18) + 1;
        uint256 minusLn = uint256(-FixedPointMathLib.lnWad(int256(u)));
        return FixedPointMathLib.fullMulDiv(minusLn, 1e36, tickets);
    }

    function _touch(address user) internal {
        uint256 now_ = currentDraw();
        _roll(holders[user], now_, user);
        _roll(total, now_, address(0));
    }

    function _roll(Holder storage h, uint256 now_, address user) internal {
        if (h.lastTouch == 0) {
            h.lastTouch = block.timestamp;
            h.drawId = now_;
            return;
        }
        if (h.drawId < now_) {
            uint256 finished = h.accrued + h.principal * (drawEnd(h.drawId) - h.lastTouch);
            _settle(h.drawId, user, finished);
            uint256 full = h.principal * period;
            for (uint256 d = h.drawId + 1; d < now_; ++d) _settle(d, user, full);
            h.drawId = now_;
            h.accrued = h.principal * (block.timestamp - (drawEnd(now_) - period));
        } else {
            h.accrued += h.principal * (block.timestamp - h.lastTouch);
        }
        h.lastTouch = block.timestamp;
    }

    function _settle(uint256 drawId, address user, uint256 tickets) internal {
        if (user == address(0)) settledTotal[drawId] = tickets;
        else settledTickets[drawId][user] = tickets;
    }

    function _ticketsAt(Holder storage h, uint256 settled, uint256 drawId) internal view returns (uint256) {
        if (h.lastTouch == 0 || drawId < h.drawId) return settled;
        uint256 end = drawEnd(drawId);
        uint256 until = block.timestamp < end ? block.timestamp : end;
        if (drawId == h.drawId) return h.accrued + h.principal * (until - h.lastTouch);
        uint256 begin = end - period;
        return until > begin ? h.principal * (until - begin) : 0;
    }
}
