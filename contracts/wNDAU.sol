// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract wNDAU is ERC20, ReentrancyGuard {

    address internal multisigCaller;

    modifier onlyMultisig() {
        require(_msgSender() == multisigCaller, "Only multisigned");
        _;
    }

    constructor(address _multisigCaller) public ERC20("Wrapped NDAU", "wNDAU") {
        require(_multisigCaller != address(0), "Zero address");
        _setupDecimals(10);
        multisigCaller = _multisigCaller;
    }

    function mintFor(address _receiver, uint256 _amount) external nonReentrant onlyMultisig {
        require(_receiver != address(0), "Zero address");
        require(_receiver != address(this), "Incorrect address");
        require(_amount > 0, "Incorrect amount");
        _mint(_receiver, _amount);
    }
}