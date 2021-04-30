// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import "../Staking.sol";

contract StakingMock is Staking {
    constructor(address _multisigCaller, address _wndau, address _unilp) public Staking(_multisigCaller, _wndau, _unilp) {
    }

    function setNextPeriod() external override {
        require(currentPeriodStart == 0 || isCooldown(), "There is active stake period");
        require(block.timestamp > currentPeriodStart, "Next staking period already set");

        currentPeriodStart = block.timestamp;
    }


    function setRewardsPeriod(uint256 _rewardsPeriod) external {
        REWARDS_PERIOD = _rewardsPeriod;
    }
    
    function setCooldownPeriod(uint256 _cooldownPeriod) external {
        COOLDOWN_PERIOD = _cooldownPeriod;
    }

}
