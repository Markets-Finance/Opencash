// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {MockAUSD} from "./MockAUSD.sol";

contract MockYieldVault {
    MockAUSD public immutable ausd;
    mapping(address => uint256) public balanceOf;
    uint256 public totalShares;

    constructor(MockAUSD ausd_) {
        ausd = ausd_;
    }

    function totalAssets() public view returns (uint256) {
        return ausd.balanceOf(address(this));
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return totalShares == 0 ? shares : (shares * totalAssets()) / totalShares;
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        shares = totalShares == 0 ? assets : (assets * totalShares) / totalAssets();
        ausd.transferFrom(msg.sender, address(this), assets);
        balanceOf[receiver] += shares;
        totalShares += shares;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        require(msg.sender == owner, "owner only");
        shares = (assets * totalShares + totalAssets() - 1) / totalAssets();
        balanceOf[owner] -= shares;
        totalShares -= shares;
        ausd.transfer(receiver, assets);
    }

    function harvest(uint256 amount) external {
        ausd.mint(address(this), amount);
    }
}
