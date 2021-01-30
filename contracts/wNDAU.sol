// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract wNDAU is ERC20 {
    constructor() public ERC20("Wrapped NDAU", "wNDAU") {

    }
}