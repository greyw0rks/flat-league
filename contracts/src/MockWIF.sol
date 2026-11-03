// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Permissionless minting is for local/test networks ONLY.
contract MockWIF is ERC20 {
    constructor() ERC20("Flat League Test WIF", "MockWIF") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
