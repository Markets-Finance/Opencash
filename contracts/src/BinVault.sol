// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "solady/tokens/ERC20.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";

/// Perpl exchange subset.
interface IPerplExchange {
    struct OrderDesc {
        uint256 orderDescId;
        uint256 perpId;
        uint8 orderType;
        uint256 orderId;
        uint256 pricePNS;
        uint256 lotLNS;
        uint256 expiryBlock;
        bool postOnly;
        bool fillOrKill;
        bool immediateOrCancel;
        uint256 maxMatches;
        uint256 leverageHdths;
        uint256 lastExecutionBlock;
        uint256 amountCNS;
        uint256 maxNegPnlCollatBPS;
    }

    struct PositionBitMap {
        uint256 bank1;
        uint256 bank2;
        uint256 bank3;
        uint256 bank4;
    }

    struct AccountInfo {
        uint256 accountId;
        uint256 balanceCNS;
        uint256 lockedBalanceCNS;
        uint8 frozen;
        address accountAddr;
        PositionBitMap positions;
    }

    struct OrderSignature {
        uint256 perpId;
        uint256 orderId;
    }

    function createAccount(uint256 amountCNS) external returns (uint256 accountId);
    function depositCollateral(uint256 amountCNS) external;
    function withdrawCollateral(uint256 amountCNS) external;
    function execOrders(OrderDesc[] calldata orderDescs, bool revertOnFail) external returns (OrderSignature[] memory);
    function getAccountByAddr(address accountAddress) external view returns (AccountInfo memory);
}

/// Strategy vault on Perpl.
contract BinVault is ERC20, ReentrancyGuard {
    uint8 internal constant OPEN_LONG = 0;
    uint8 internal constant OPEN_SHORT = 1;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant DEAD_SHARES = 1_000;
    uint256 internal constant MIN_FIRST_DEPOSIT = 1e6;
    address internal constant DEAD = address(0xdead);

    address public immutable asset;
    IPerplExchange public immutable exchange;
    address public immutable manager;
    address public immutable guardian;
    uint256 public immutable maxLeverageHdths;
    uint256 public immutable performanceFeeBps;
    uint256 public immutable epochSeconds;

    string internal _name;
    string internal _symbol;
    mapping(uint256 perpId => bool) public allowedPerp;

    bool public open;
    bool public paused;
    bool public hasAccount;
    uint256 public epochEnds;
    uint256 public highWaterMark;

    event EpochStarted(uint256 deployedCNS, uint256 endsAt);
    event Settled(uint256 assets, uint256 pricePerShare, uint256 feeShares);
    event Traded(uint256 perpId, uint8 orderType, uint256 lotLNS, uint256 leverageHdths);
    event Deposited(address indexed owner, uint256 assets, uint256 shares);
    event Redeemed(address indexed owner, uint256 shares, uint256 assets);
    event Paused(bool paused);

    error NotManager();
    error NotGuardian();
    error EpochOpen();
    error EpochClosed();
    error IsPaused();
    error PerpNotAllowed(uint256 perpId);
    error LeverageTooHigh(uint256 leverageHdths);
    error NotFlat();
    error TooEarly();
    error ZeroAmount();

    constructor(
        string memory name_,
        string memory symbol_,
        address asset_,
        address exchange_,
        address manager_,
        address guardian_,
        uint256[] memory perps,
        uint256 maxLeverageHdths_,
        uint256 performanceFeeBps_,
        uint256 epochSeconds_
    ) {
        require(performanceFeeBps_ <= 3_000, "fee above 30%");
        _name = name_;
        _symbol = symbol_;
        asset = asset_;
        exchange = IPerplExchange(exchange_);
        manager = manager_;
        guardian = guardian_;
        maxLeverageHdths = maxLeverageHdths_;
        performanceFeeBps = performanceFeeBps_;
        epochSeconds = epochSeconds_;
        for (uint256 i; i < perps.length; ++i) allowedPerp[perps[i]] = true;
        highWaterMark = 1e18;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function totalAssets() public view returns (uint256) {
        return SafeTransferLib.balanceOf(asset, address(this));
    }

    function pricePerShare() public view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? 1e18 : FixedPointMathLib.fullMulDiv(totalAssets(), 1e18, supply);
    }

    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (open) revert EpochOpen();
        if (assets == 0) revert ZeroAmount();
        uint256 supply = totalSupply();
        if (supply == 0) {
            if (assets < MIN_FIRST_DEPOSIT) revert ZeroAmount();
            shares = assets - DEAD_SHARES;
            _mint(DEAD, DEAD_SHARES);
        } else {
            shares = FixedPointMathLib.fullMulDiv(assets, supply, totalAssets());
        }
        if (shares == 0) revert ZeroAmount();
        SafeTransferLib.safeTransferFrom(asset, msg.sender, address(this), assets);
        _mint(msg.sender, shares);
        emit Deposited(msg.sender, assets, shares);
    }

    function redeem(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (open) revert EpochOpen();
        if (shares == 0) revert ZeroAmount();
        assets = FixedPointMathLib.fullMulDiv(shares, totalAssets(), totalSupply());
        _burn(msg.sender, shares);
        SafeTransferLib.safeTransfer(asset, msg.sender, assets);
        emit Redeemed(msg.sender, shares, assets);
    }

    function startEpoch() external nonReentrant {
        if (msg.sender != manager) revert NotManager();
        if (open) revert EpochOpen();
        if (paused) revert IsPaused();
        uint256 amount = totalAssets();
        if (amount == 0) revert ZeroAmount();
        SafeTransferLib.safeApprove(asset, address(exchange), amount);
        if (hasAccount) {
            exchange.depositCollateral(amount);
        } else {
            exchange.createAccount(amount);
            hasAccount = true;
        }
        open = true;
        epochEnds = block.timestamp + epochSeconds;
        emit EpochStarted(amount, epochEnds);
    }

    function trade(IPerplExchange.OrderDesc[] calldata orders) external nonReentrant {
        if (msg.sender != manager) revert NotManager();
        if (!open) revert EpochClosed();
        if (paused) revert IsPaused();
        for (uint256 i; i < orders.length; ++i) {
            IPerplExchange.OrderDesc calldata order = orders[i];
            if (!allowedPerp[order.perpId]) revert PerpNotAllowed(order.perpId);
            bool opening = order.orderType == OPEN_LONG || order.orderType == OPEN_SHORT;
            if (opening && order.leverageHdths > maxLeverageHdths) revert LeverageTooHigh(order.leverageHdths);
            emit Traded(order.perpId, order.orderType, order.lotLNS, order.leverageHdths);
        }
        exchange.execOrders(orders, true);
    }

    function settle() external nonReentrant {
        if (!open) revert EpochClosed();
        bool keeper = msg.sender == manager || msg.sender == guardian;
        if (!keeper && block.timestamp < epochEnds) revert TooEarly();
        IPerplExchange.AccountInfo memory info = exchange.getAccountByAddr(address(this));
        IPerplExchange.PositionBitMap memory p = info.positions;
        if (info.lockedBalanceCNS != 0 || (p.bank1 | p.bank2 | p.bank3 | p.bank4) != 0) revert NotFlat();
        if (info.balanceCNS != 0) exchange.withdrawCollateral(info.balanceCNS);
        open = false;
        uint256 feeShares = _takePerformanceFee();
        emit Settled(totalAssets(), pricePerShare(), feeShares);
    }

    function setPaused(bool value) external {
        if (msg.sender != guardian) revert NotGuardian();
        paused = value;
        emit Paused(value);
    }

    function _takePerformanceFee() internal returns (uint256 feeShares) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        uint256 price = pricePerShare();
        if (price <= highWaterMark) return 0;
        uint256 gain = FixedPointMathLib.fullMulDiv(price - highWaterMark, supply, 1e18);
        uint256 fee = FixedPointMathLib.fullMulDiv(gain, performanceFeeBps, BPS);
        uint256 assetsAfterFee = totalAssets() - fee;
        feeShares = fee == 0 ? 0 : FixedPointMathLib.fullMulDiv(fee, supply, assetsAfterFee);
        if (feeShares != 0) _mint(manager, feeShares);
        highWaterMark = pricePerShare();
    }
}
