// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "solady/tokens/ERC20.sol";

contract MockAUSD is ERC20 {
    function name() public pure override returns (string memory) {
        return "Mock AUSD";
    }

    function symbol() public pure override returns (string memory) {
        return "AUSD";
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
