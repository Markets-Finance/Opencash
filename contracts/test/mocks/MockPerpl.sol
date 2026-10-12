// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IPerplExchange} from "../../src/BinVault.sol";
import {MockAUSD} from "./MockAUSD.sol";

contract MockPerpl {
    MockAUSD public immutable ausd;
    mapping(address => uint256) public balance;
    mapping(address => uint256) public locked;
    mapping(address => uint256) public positionBits;
    uint256 public orders;

    constructor(MockAUSD ausd_) {
        ausd = ausd_;
    }

    function createAccount(uint256 amountCNS) external returns (uint256) {
        ausd.transferFrom(msg.sender, address(this), amountCNS);
        balance[msg.sender] += amountCNS;
        return 1;
    }

    function depositCollateral(uint256 amountCNS) external {
        ausd.transferFrom(msg.sender, address(this), amountCNS);
        balance[msg.sender] += amountCNS;
    }

    function withdrawCollateral(uint256 amountCNS) external {
        balance[msg.sender] -= amountCNS;
        ausd.transfer(msg.sender, amountCNS);
    }

    function execOrders(IPerplExchange.OrderDesc[] calldata descs, bool) external returns (IPerplExchange.OrderSignature[] memory out) {
        orders += descs.length;
        out = new IPerplExchange.OrderSignature[](descs.length);
    }

    function getAccountByAddr(address who) external view returns (IPerplExchange.AccountInfo memory info) {
        info.accountId = 1;
        info.balanceCNS = balance[who];
        info.lockedBalanceCNS = locked[who];
        info.accountAddr = who;
        info.positions.bank1 = positionBits[who];
    }

    function setLocked(address who, uint256 value) external {
        locked[who] = value;
    }

    function setPositions(address who, uint256 bits) external {
        positionBits[who] = bits;
    }

    function pnl(address who, int256 amount) external {
        if (amount >= 0) {
            ausd.mint(address(this), uint256(amount));
            balance[who] += uint256(amount);
        } else {
            balance[who] -= uint256(-amount);
        }
    }
}
