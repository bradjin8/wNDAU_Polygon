// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Staking {
    using SafeMath for uint256;

    uint256 public REWARDS_PERIOD = 90 days;
    uint256 public COOLDOWN_PERIOD = 30 days;
    uint256 public constant MAX_BONUS_MULTIPLIER = 6;

    struct Stake {
        uint256 stakeTime;
        uint256 stakeAmount;
        uint256 collectedRewardsTime;
    }

    mapping(address => Stake) public staked;
    uint256 public totalStaked;
    mapping(uint256 => uint256) public roundRewards;
    mapping(uint256 => uint256) public stakedInRound;
    uint256 public roundNum;

    address public wndauToken;
    address public uniswapLPtoken;
    
    uint256 public currentPeriodStart;

    address internal multisigCaller;

    modifier onlyMultisig() {
        require(msg.sender == multisigCaller, "Only multisigned");
        _;
    }

    constructor(address _multisigCaller, address _wndau, address _unilp) public {
        wndauToken = _wndau;
        uniswapLPtoken = _unilp;
        multisigCaller = _multisigCaller;
    }

    function setNextPeriod() external virtual onlyMultisig {
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

    function getWndau(address _recepient) external virtual onlyMultisig {
        require(isCooldown(), "Can not withdraw during staking period");

        roundRewards[roundNum] = 0;
        roundRewards[roundNum.sub(1)] = 0;
        IERC20(wndauToken).transfer(_recepient, IERC20(wndauToken).balanceOf(address(this)));
    }

    function resetRewards(uint256 _roundNum) external virtual onlyMultisig {
        require(_roundNum > 0 && _roundNum <= roundNum, "Incorrect round num");
        roundRewards[_roundNum] = IERC20(wndauToken).balanceOf(address(this));
    }

    // stake Uniswap LP tokens
    function stake(uint256 _amount) external {
        require(_amount > 0, "Incorrect amount");

        Stake storage s = staked[msg.sender];
        
        // Claim before stake increasement
        if (s.stakeAmount > 0 && isCooldown())
        {
            claim();
        }

        IERC20(uniswapLPtoken).transferFrom(msg.sender, address(this), _amount);

        s.stakeTime = block.timestamp;
        s.stakeAmount = s.stakeAmount.add(_amount);
        totalStaked = totalStaked.add(_amount);

        if (isCooldown() && block.timestamp > currentPeriodStart) {
            stakedInRound[roundNum + 1] = stakedInRound[roundNum + 1].add(_amount);
        }
        else {
            stakedInRound[roundNum] = stakedInRound[roundNum].add(_amount);
        }
    }

    // unstake Uniswap LP tokens
    function unstake() external {
        Stake storage s = staked[msg.sender];

        uint256 _amount = s.stakeAmount;
        require(_amount > 0, "No staked tokens");

        if (isCooldown())
        {
            claim();
        }
        else
        {
            stakedInRound[getCurrentRound()] = stakedInRound[getCurrentRound()].sub(_amount);
        }

        s.stakeAmount = 0;
        s.stakeTime = 0;
        s.collectedRewardsTime = 0;
        totalStaked = totalStaked.sub(_amount);

        IERC20(uniswapLPtoken).transfer(msg.sender, _amount);
    }

    // claim wNDAU rewards
    function claim() public {
        // Can claim on cooldown period only
        require(isCooldown(), "Can not claim during staking period");

        Stake storage s = staked[msg.sender];

        // Check that the user hasn't colelcted rewards yet
        require(s.stakeAmount > 0, "No staked tokens");
        if (!hasNotCollected(s.collectedRewardsTime)) {
            return;
        }

        uint256 rewards = calculateUserRewards(msg.sender);

        if (rewards == 0) {
            return;
        }

        require(IERC20(wndauToken).balanceOf(address(this)) >= rewards, "Not enough wNDAU on the contract");

        s.collectedRewardsTime = block.timestamp;
        //Update stake time if it is planned to be prolongated
        s.stakeTime = block.timestamp;

        IERC20(wndauToken).transfer(msg.sender, rewards);
    }

    function calculateUserRewards(address _user) public view returns(uint256) {
        Stake storage s = staked[_user];
        uint256 _stakeTime = s.stakeTime;
        
        // No stake
        if (s.stakeAmount == 0 || _stakeTime == 0) return 0;
        if (currentPeriodStart == 0) return 0; // No period started

        uint256 _currentPeriodEnd = currentPeriodStart.add(REWARDS_PERIOD);
        
        // Start calculation from the last stake
        if (_stakeTime < currentPeriodStart) {
            _stakeTime = currentPeriodStart;
        }

        // if in cooldown period
        if (_stakeTime > _currentPeriodEnd) return 0; // Staked in current cooldown
        if (s.collectedRewardsTime > _currentPeriodEnd) return 0; // Already collected reward

        // Check how long are funds staked
        uint256 lockTime;

        if (block.timestamp > _currentPeriodEnd) {
            lockTime = _currentPeriodEnd.sub(_stakeTime);
        }
        else {
            lockTime = block.timestamp.sub(_stakeTime);
        }

        return calculateRewardsWithBonus(lockTime, s.stakeAmount);
    }


    function calculateRewardsWithBonus(uint256 lockTime, uint256 _stakeAmount) public view returns(uint256) {
        uint256 currentRoundReward = roundRewards[getCurrentRound()];
        if (currentRoundReward == 0) return 0;
        uint256 curStake = stakedInRound[getCurrentRound()];
        if (curStake == 0) return 0;

        uint256 baseRewardAmount = currentRoundReward.div(MAX_BONUS_MULTIPLIER);

        uint256 multiplier = lockTime.mul(MAX_BONUS_MULTIPLIER).div(REWARDS_PERIOD) + 1;

        if (multiplier > 6) multiplier = 6;

        return baseRewardAmount.mul(_stakeAmount)
                               .mul(multiplier) // Apply multiplier
                               .mul(lockTime) // Get part based on the length of stake
                               .div(REWARDS_PERIOD)
                               .div(curStake); // Get share in pool
    }

    function isCooldown() public view returns(bool) {
        return block.timestamp < currentPeriodStart || block.timestamp > currentPeriodStart.add(REWARDS_PERIOD);
    }


    function hasNotCollected(uint256 _rewardsTime) internal view returns(bool) {
        if (_rewardsTime == 0) return true;

        if (_rewardsTime < currentPeriodStart) return true;

        return false;
    }

    function getCurrentRound() public view returns(uint256) {
        if (block.timestamp < currentPeriodStart) {
            return roundNum - 1;
        }
        else {
            return roundNum;
        }
    }

}
