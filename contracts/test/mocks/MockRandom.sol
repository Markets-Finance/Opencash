// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract MockRandom {
    mapping(uint256 => uint256) public randomness;

    function set(uint256 drawId, uint256 value) external {
        randomness[drawId] = value;
    }
}
