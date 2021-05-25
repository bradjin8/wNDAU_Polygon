// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import "../Staking.sol";

contract StakingMock is Staking {
    constructor(address _multisigCaller, address _wndau, address _unilp) public Staking(_multisigCaller, _wndau, _unilp) {
    }

    function setNextPeriod() external override {
        require(currentPeriodStart == 0 || isCooldown(), "There is active stake period");
        require(block.timestamp > currentPeriodStart + REWARDS_PERIOD + COOLDOWN_PERIOD, "Too early to start");
        

        currentPeriodStart = block.timestamp;
        uint256 stakedInPrevious = totalStaked.sub(stakedInRound[roundNum + 1]);
        if (stakedInPrevious > 0) {
            stakedInRound[roundNum + 1] = stakedInRound[roundNum + 1].add(stakedInPrevious);
        }
        roundNum += 1;
        roundRewards[roundNum] = IERC20(wndauToken).balanceOf(address(this));
    }


    function setRewardsPeriod(uint256 _rewardsPeriod) external {
        REWARDS_PERIOD = _rewardsPeriod;
    }
    
    function setCooldownPeriod(uint256 _cooldownPeriod) external {
        COOLDOWN_PERIOD = _cooldownPeriod;
    }

    function getWndau(address _recepient) external override {
        require(isCooldown(), "Can not withdraw during staking period");

        roundRewards[getCurrentRound()] = 0;
        IERC20(wndauToken).transfer(_recepient, IERC20(wndauToken).balanceOf(address(this)));
    }

    function resetRewards(uint256 _roundNum) external override {
        require(_roundNum > 0 && _roundNum <= roundNum, "Incorrect round num");
        roundRewards[_roundNum] = IERC20(wndauToken).balanceOf(address(this));
    }

}
