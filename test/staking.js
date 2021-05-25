const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider || 'ws://localhost:8545');
const { expect } = require('chai');
const timeMachine = require('ganache-time-traveler');
const truffleAssert = require('truffle-assertions');

const WNDAU = artifacts.require('wNDAU');
const MultiSigWallet = artifacts.require('MultiSigWalletMock');
const TestToken = artifacts.require('TestERC20');
const Staking = artifacts.require('Staking');

describe('Testset for staking', () => {
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    let deployer;
    let signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8;
    let signer9, signer10, signer11, signer12, signer13, signer14, signer15;
    let user1, user2;
  
    let tokenWNDAU;
    let multisig;
    let staking;
    let testToken;
    let snapshotId;
    let signersArr;
    const rewardsAmount = 600;

    let amountToAdd;
  
    before(async() => {
      [
        deployer,
        signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8,
        signer9, signer10, signer11, signer12, signer13, signer14, signer15,
        user1, user2, user3
      ] = await web3.eth.getAccounts();
      signersArr = [signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8,
        signer9, signer10, signer11, signer12, signer13, signer14, signer15];
  
      multisig = await MultiSigWallet.new([signer1, signer2, signer3, signer4, signer5, signer6, signer7,
        signer8, signer9, signer10, signer11, signer12, signer13,
        signer14, signer15], { from: deployer });
  
      tokenWNDAU = await WNDAU.new(multisig.address, { from: deployer });

      testToken = await TestToken.new("UniLP", "UNILP", 18, { from: deployer });
      staking = await Staking.new(multisig.address, tokenWNDAU.address, testToken.address, { from: deployer });

      await testToken.mint(200, {from : user1});
      await testToken.mint(200, {from : user2});
      await testToken.mint(200, {from : user3});
    });
  
  
    describe('Staking functionality', () => { 
      it('Is not started', async() => {
          expect((await staking.totalStaked()).toNumber(), "Not 0").to.equal(0);
          expect((await staking.currentPeriodStart()).toNumber(), "Should not be started").to.equal(0);
          expect(await staking.isCooldown(), "Is not cooldown").to.be.true;
      });

      it('Should be zero rewards', async() => {
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards").to.equal(0);
      });

      it('Cannot claim with no stake', async() => {
        await truffleAssert.reverts(
            staking.claim({from: user1}),
            'No staked tokens'
          );
      });

      it('Can stake before start', async() => {
        let balBefore = await testToken.balanceOf(user1);

        expect((await staking.totalStaked()).toNumber(), "Should not be staked").to.equal(0);
        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should be 0").to.equal(0);

        await testToken.approve(staking.address, 50, {from: user1});
        await staking.stake(50, {from: user1});
        
        let balAfter = await testToken.balanceOf(user1);
        expect((await staking.totalStaked()).toNumber(), "Should be staked").to.equal(50);
        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should have stake").to.equal(50);

        expect((balBefore.sub(balAfter)).toNumber(), "Tokens should be transferred").to.equal(50);
      });

      it('Should be zero rewards before the start', async() => {
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards").to.equal(0);
      });

      it('Can unstake before start', async() => {
        
        expect((await staking.currentPeriodStart()).toNumber(), "Should not be started").to.equal(0);
        expect(await staking.isCooldown(), "Is not cooldown").to.be.true;

        let balBefore = await testToken.balanceOf(user1);
        expect((await staking.totalStaked()).toNumber(), "Should be staked").to.equal(50);
        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should have stake").to.equal(50);

        await staking.unstake({from: user1});

        let balAfter = await testToken.balanceOf(user1);
        expect((await staking.totalStaked()).toNumber(), "Should not be staked").to.equal(0);
        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should be 0").to.equal(0);

        expect(balAfter.sub(balBefore).toNumber(), "Tokens should be transferred").to.equal(50);

      });

      it('Stake before start', async() => {

        //1
        await testToken.approve(staking.address, 50, {from: user1});
        await staking.stake(50, {from: user1});
        //2
        await testToken.approve(staking.address, 50, {from: user2});
        await staking.stake(50, {from: user2});

        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(100);

      });

      it('Should not have rewards before rewards period start', async() => {
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards").to.equal(0);
      });

      it('Nothing to claim before start', async() => {
          let balanceWndauBefore = await tokenWNDAU.balanceOf(user1);
          let balanceStakingWndauBefore = await tokenWNDAU.balanceOf(staking.address);          
          
          await staking.claim({from: user1});
          
          let balanceWndauAfter = await tokenWNDAU.balanceOf(user1);
          let balanceStakingWndauAfter = await tokenWNDAU.balanceOf(staking.address);
          
          expect(balanceWndauBefore.toNumber(), "Balance should not change").to.equal(balanceWndauAfter.toNumber());
          expect(balanceStakingWndauBefore.toNumber(), "Staking balance should not change").to.equal(balanceStakingWndauAfter.toNumber());

      });

      it('Can mint rewards', async() => {
        let encodedData = tokenWNDAU.contract.methods.mintFor(staking.address, rewardsAmount).encodeABI();

        await multisig.submitTransaction("Name", tokenWNDAU.address, 0, encodedData, { from: signer1 });
        await multisig.confirmTransaction(0, { from: signer2 });
        tx = await multisig.confirmTransaction(0, { from: signer3 });

        console.log(tx.receipt.gasUsed, "Gas used for Tx confirmation");
        console.log(tx.receipt.cumulativeGasUsed);

        expect((await tokenWNDAU.balanceOf(staking.address)).toNumber(), "Not minted").to.equal(rewardsAmount);

      });

      it('Nothing to claim before start even if rewards are minted', async() => {
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards").to.equal(0);

        let balanceWndauBefore = await tokenWNDAU.balanceOf(user1);
        let balanceStakingWndauBefore = await tokenWNDAU.balanceOf(staking.address);          
        
        await staking.claim({from: user1});
        
        let balanceWndauAfter = await tokenWNDAU.balanceOf(user1);
        let balanceStakingWndauAfter = await tokenWNDAU.balanceOf(staking.address);
        
        expect(balanceWndauBefore.toNumber(), "Balance should not change").to.equal(balanceWndauAfter.toNumber());
        expect(balanceStakingWndauBefore.toNumber(), "Staking balance should not change").to.equal(balanceStakingWndauAfter.toNumber());

      });

      it('Can start rewards period', async() => {
          expect((await staking.currentPeriodStart()).toNumber(), "Should be not started").to.equal(0);

          let encodedData = staking.contract.methods.setNextPeriod().encodeABI();

          await multisig.submitTransaction("Name", staking.address, 0, encodedData, { from: signer1 });
          await multisig.confirmTransaction(1, { from: signer2 });
          await multisig.confirmTransaction(1, { from: signer3 });

          await timeMachine.advanceBlock(1);
          await timeMachine.advanceTime(20);

          expect((await staking.currentPeriodStart()).toNumber(), "Should be not started").to.be.greaterThan(0);
          expect(await staking.isCooldown(), "Should be not started").to.be.false;
      });

      it('10 days has passed', async() => {
        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(10*24*60*60);
        await timeMachine.advanceBlock(1);

        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should have stake 1").to.equal(50);
        expect((await staking.staked(user1)).stakeTime.toNumber(), "Should have stake 1").to.be.greaterThan(0);
        expect((await staking.staked(user1)).collectedRewardsTime.toNumber(), "Should have stake 1").to.equal(0);

        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake 2").to.equal(50);
        expect((await staking.staked(user2)).stakeTime.toNumber(), "Should have stake 2").to.be.greaterThan(0);
        expect((await staking.staked(user2)).collectedRewardsTime.toNumber(), "Should have stake 2").to.equal(0);


        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(100);

        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 1; // 6 * 10 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 10 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards 1").to.equal(rew);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should not have rewards 2").to.equal(rew);
    });

      it('15 days has passed', async() => {
        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(5*24*60*60);
        await timeMachine.advanceBlock(1);

        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should have stake 1").to.equal(50);
        expect((await staking.staked(user1)).stakeTime.toNumber(), "Should have stake 1").to.be.greaterThan(0);
        expect((await staking.staked(user1)).collectedRewardsTime.toNumber(), "Should have stake 1").to.equal(0);

        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake 2").to.equal(50);
        expect((await staking.staked(user2)).stakeTime.toNumber(), "Should have stake 2").to.be.greaterThan(0);
        expect((await staking.staked(user2)).collectedRewardsTime.toNumber(), "Should have stake 2").to.equal(0);


        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(100);

        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 2; // 6 * 15 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 15 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards 1").to.equal(rew);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should not have rewards 2").to.equal(rew);
    });

    it('40 days has passed', async() => {
        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(25*24*60*60);
        await timeMachine.advanceBlock(1);

        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should have stake 1").to.equal(50);
        expect((await staking.staked(user1)).stakeTime.toNumber(), "Should have stake 1").to.be.greaterThan(0);
        expect((await staking.staked(user1)).collectedRewardsTime.toNumber(), "Should have stake 1").to.equal(0);

        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake 2").to.equal(50);
        expect((await staking.staked(user2)).stakeTime.toNumber(), "Should have stake 2").to.be.greaterThan(0);
        expect((await staking.staked(user2)).collectedRewardsTime.toNumber(), "Should have stake 2").to.equal(0);


        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(100);

        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 3; // 6 * 40 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 40 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards 1").to.equal(rew);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should not have rewards 2").to.equal(rew);
    });
      
      it('Can unstake within rewards period', async() => {

        let balBefore = await testToken.balanceOf(user2);
        expect((await staking.totalStaked()).toNumber(), "Should be staked").to.equal(100);
        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake").to.equal(50);

        await staking.unstake({from: user2});

        let balAfter = await testToken.balanceOf(user2);
        expect((await staking.totalStaked()).toNumber(), "Should not be staked").to.equal(50);
        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should be 0").to.equal(0);

        expect(balAfter.sub(balBefore).toNumber(), "Tokens should be transferred").to.equal(50);

        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(50);
      });

      it('Lost all rewards', async() => {
        let baseRewards = 100; // 600 / 6;
        let totalStake = 50;
        let curStake = 50;
        let multiplier = 3; // 6 * 40 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 40 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should have rewards 1").to.equal(rew);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should not have rewards 2").to.equal(0);
    });

      it('Can stake within rewards period', async() => {

        let balBefore = await testToken.balanceOf(user2);

        expect((await staking.totalStaked()).toNumber(), "Should not be staked").to.equal(50);
        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should be 0").to.equal(0);

        await testToken.approve(staking.address, 50, {from: user2});
        await staking.stake(50, {from: user2});
        
        let balAfter = await testToken.balanceOf(user2);
        expect((await staking.totalStaked()).toNumber(), "Should be staked").to.equal(100);
        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake").to.equal(50);

        expect((balBefore.sub(balAfter)).toNumber(), "Tokens should be transferred").to.equal(50);

        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(100);

      });

      it('No rewards after the re-stake', async() => {
        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 3; // 6 * 40 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 40 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards 1").to.equal(rew);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should not have rewards 2").to.equal(0);
    });

    it('60 days has passed', async() => {
        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(20*24*60*60);
        await timeMachine.advanceBlock(1);

        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should have stake 1").to.equal(50);
        expect((await staking.staked(user1)).stakeTime.toNumber(), "Should have stake 1").to.be.greaterThan(0);
        expect((await staking.staked(user1)).collectedRewardsTime.toNumber(), "Should have stake 1").to.equal(0);

        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake 2").to.equal(50);
        expect((await staking.staked(user2)).stakeTime.toNumber(), "Should have stake 2").to.be.greaterThan(0);
        expect((await staking.staked(user2)).collectedRewardsTime.toNumber(), "Should have stake 2").to.equal(0);


        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(100);

        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 5; // 6 * 60 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 60 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should have rewards 1").to.equal(rew);


        curStake = 50;
        multiplier = 2; // 6 * 20 / 90

        rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 20 / 90);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should have rewards 2").to.equal(rew);
    });


      it('Cannot claim during rewards period', async() => {
        await truffleAssert.reverts(
            staking.claim({from: user1}),
            'Can not claim during staking period'
          );
      });

      it('Cooldown period cames automatically', async() => {
        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(30*24*60*60 + 1);
        await timeMachine.advanceBlock(1);

        expect(await staking.isCooldown(), "Is not cooldown").to.be.true;
      });

      it('Can claim after rewards period', async() => {
        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 6; // 6 * 90 / 90

        let rew1 = Math.floor(baseRewards  * (curStake/totalStake) * multiplier);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should have rewards 1").to.equal(rew1);

        curStake = 50;
        multiplier = 4; // 6 * 50 / 90

        let rew2 = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 50 / 90);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should have rewards 2").to.equal(rew2);



        let balanceWndauBefore = await tokenWNDAU.balanceOf(user1);
        let balanceStakingWndauBefore = await tokenWNDAU.balanceOf(staking.address);          
        
        await staking.claim({from: user1});
        
        let balanceWndauAfter = await tokenWNDAU.balanceOf(user1);
        let balanceStakingWndauAfter = await tokenWNDAU.balanceOf(staking.address);
        
        expect((balanceWndauAfter.sub(balanceWndauBefore)).toNumber(), "Balance should increase 1").to.equal(rew1);
        expect((balanceStakingWndauBefore.sub(balanceStakingWndauAfter)).toNumber(), "Staking balance should decrease 1").to.equal(rew1);


        balanceWndauBefore = await tokenWNDAU.balanceOf(user2);
        balanceStakingWndauBefore = await tokenWNDAU.balanceOf(staking.address);          
        
        await staking.claim({from: user2});
        
        balanceWndauAfter = await tokenWNDAU.balanceOf(user2);
        balanceStakingWndauAfter = await tokenWNDAU.balanceOf(staking.address);
        
        expect((balanceWndauAfter.sub(balanceWndauBefore)).toNumber(), "Balance should increase 2").to.equal(rew2);
        expect((balanceStakingWndauBefore.sub(balanceStakingWndauAfter)).toNumber(), "Staking balance should decrease 2").to.equal(rew2);

        amountToAdd = rew1 + rew2;

      });

      it('Cannot claim again', async() => {
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should have rewards 1").to.equal(0);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should have rewards 2").to.equal(0);



        let balanceWndauBefore = await tokenWNDAU.balanceOf(user1);
        let balanceStakingWndauBefore = await tokenWNDAU.balanceOf(staking.address);          
        
        await staking.claim({from: user1});
        
        let balanceWndauAfter = await tokenWNDAU.balanceOf(user1);
        let balanceStakingWndauAfter = await tokenWNDAU.balanceOf(staking.address);
        
        expect(balanceWndauBefore.toNumber(), "Balance should not increase 1").to.equal(balanceWndauAfter.toNumber());
        expect(balanceStakingWndauBefore.toNumber(), "Staking balance should not increase 1").to.equal(balanceStakingWndauAfter.toNumber());


        balanceWndauBefore = await tokenWNDAU.balanceOf(user2);
        balanceStakingWndauBefore = await tokenWNDAU.balanceOf(staking.address);          
        
        await staking.claim({from: user2});
        
        balanceWndauAfter = await tokenWNDAU.balanceOf(user2);
        balanceStakingWndauAfter = await tokenWNDAU.balanceOf(staking.address);
        
        expect(balanceWndauBefore.toNumber(), "Balance should not increase 2").to.equal(balanceWndauAfter.toNumber());
        expect(balanceStakingWndauBefore.toNumber(), "Staking balance should not increase 2").to.equal(balanceStakingWndauAfter.toNumber());

      });


      it('Cooldown continuos', async() => {

        expect(await staking.isCooldown(), "Is not cooldown").to.be.true;
        
        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(30*24*60*60 + 1);
        await timeMachine.advanceBlock(1);

        expect(await staking.isCooldown(), "Is not cooldown").to.be.true;


        let encodedData = tokenWNDAU.contract.methods.mintFor(staking.address, amountToAdd).encodeABI();

        await multisig.submitTransaction("Name", tokenWNDAU.address, 0, encodedData, { from: signer1 });
        await multisig.confirmTransaction(2, { from: signer2 });
        await multisig.confirmTransaction(2, { from: signer3 });

        expect((await tokenWNDAU.balanceOf(staking.address)).toNumber(), "Not minted").to.equal(rewardsAmount);


        encodedData = staking.contract.methods.setNextPeriod().encodeABI();

        await multisig.submitTransaction("Name", staking.address, 0, encodedData, { from: signer1 });
        await multisig.confirmTransaction(3, { from: signer2 });
        await multisig.confirmTransaction(3, { from: signer3 });

        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(1);


        expect(await staking.isCooldown(), "Should not be cooldown").to.be.false;
      });

    });

    describe('Second round', () => {
      it('10 days has passed', async() => {
        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(10*24*60*60);
        await timeMachine.advanceBlock(1);

        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should have stake 1").to.equal(50);
        expect((await staking.staked(user1)).stakeTime.toNumber(), "Should have stake time 1").to.be.greaterThan(0);
        expect((await staking.staked(user1)).collectedRewardsTime.toNumber(), "Should have claim time 1").to.be.greaterThan(0);

        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake 2").to.equal(50);
        expect((await staking.staked(user2)).stakeTime.toNumber(), "Should have stake time 2").to.be.greaterThan(0);
        expect((await staking.staked(user2)).collectedRewardsTime.toNumber(), "Should have claim time 2").to.be.greaterThan(0);

        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(100);

        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 1; // 6 * 10 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 10 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards 1").to.equal(rew);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should not have rewards 2").to.equal(rew);
    });

      it('15 days has passed', async() => {
        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(5*24*60*60);
        await timeMachine.advanceBlock(1);

        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should have stake 1").to.equal(50);
        expect((await staking.staked(user1)).stakeTime.toNumber(), "Should have stake 1").to.be.greaterThan(0);

        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake 2").to.equal(50);
        expect((await staking.staked(user2)).stakeTime.toNumber(), "Should have stake 2").to.be.greaterThan(0);


        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(100);

        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 2; // 6 * 15 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 15 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards 1").to.equal(rew);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should not have rewards 2").to.equal(rew);
    });

    it('40 days has passed', async() => {
        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(25*24*60*60);
        await timeMachine.advanceBlock(1);

        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should have stake 1").to.equal(50);
        expect((await staking.staked(user1)).stakeTime.toNumber(), "Should have stake 1").to.be.greaterThan(0);

        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake 2").to.equal(50);
        expect((await staking.staked(user2)).stakeTime.toNumber(), "Should have stake 2").to.be.greaterThan(0);


        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(100);

        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 3; // 6 * 40 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 40 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards 1").to.equal(rew);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should not have rewards 2").to.equal(rew);
    });
      
      it('Can unstake within rewards period', async() => {

        let balBefore = await testToken.balanceOf(user2);
        expect((await staking.totalStaked()).toNumber(), "Should be staked").to.equal(100);
        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake").to.equal(50);

        await staking.unstake({from: user2});

        let balAfter = await testToken.balanceOf(user2);
        expect((await staking.totalStaked()).toNumber(), "Should not be staked").to.equal(50);
        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should be 0").to.equal(0);

        expect(balAfter.sub(balBefore).toNumber(), "Tokens should be transferred").to.equal(50);

        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(50);
      });

      it('Lost all rewards', async() => {
        let baseRewards = 100; // 600 / 6;
        let totalStake = 50;
        let curStake = 50;
        let multiplier = 3; // 6 * 40 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 40 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should have rewards 1").to.equal(rew);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should not have rewards 2").to.equal(0);
    });

      it('Can stake within rewards period', async() => {

        let balBefore = await testToken.balanceOf(user2);

        expect((await staking.totalStaked()).toNumber(), "Should not be staked").to.equal(50);
        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should be 0").to.equal(0);

        await testToken.approve(staking.address, 50, {from: user2});
        await staking.stake(50, {from: user2});
        
        let balAfter = await testToken.balanceOf(user2);
        expect((await staking.totalStaked()).toNumber(), "Should be staked").to.equal(100);
        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake").to.equal(50);

        expect((balBefore.sub(balAfter)).toNumber(), "Tokens should be transferred").to.equal(50);

        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(100);

      });

      it('No rewards after the re-stake', async() => {
        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 3; // 6 * 40 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 40 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should not have rewards 1").to.equal(rew);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should not have rewards 2").to.equal(0);
    });

    it('60 days has passed', async() => {
        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(20*24*60*60);
        await timeMachine.advanceBlock(1);

        expect((await staking.staked(user1)).stakeAmount.toNumber(), "Should have stake 1").to.equal(50);
        expect((await staking.staked(user1)).stakeTime.toNumber(), "Should have stake 1").to.be.greaterThan(0);

        expect((await staking.staked(user2)).stakeAmount.toNumber(), "Should have stake 2").to.equal(50);
        expect((await staking.staked(user2)).stakeTime.toNumber(), "Should have stake 2").to.be.greaterThan(0);


        expect((await staking.totalStaked()).toNumber(), "Should be staked all").to.equal(100);

        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 5; // 6 * 60 / 90

        let rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 60 / 90);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should have rewards 1").to.equal(rew);


        curStake = 50;
        multiplier = 2; // 6 * 20 / 90

        rew = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 20 / 90);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should have rewards 2").to.equal(rew);
    });


      it('Cannot claim during rewards period', async() => {
        await truffleAssert.reverts(
            staking.claim({from: user1}),
            'Can not claim during staking period'
          );
      });

      it('Cooldown period cames automatically', async() => {
        await timeMachine.advanceBlock(1);
        await timeMachine.advanceTime(30*24*60*60 + 1);
        await timeMachine.advanceBlock(1);

        expect(await staking.isCooldown(), "Is not cooldown").to.be.true;
      });

      it('Can claim after rewards period', async() => {
        let baseRewards = 100; // 600 / 6;
        let totalStake = 100;
        let curStake = 50;
        let multiplier = 6; // 6 * 90 / 90

        let rew1 = Math.floor(baseRewards  * (curStake/totalStake) * multiplier);
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should have rewards 1").to.equal(rew1);

        curStake = 50;
        multiplier = 4; // 6 * 50 / 90

        let rew2 = Math.floor(baseRewards  * (curStake/totalStake) * multiplier * 50 / 90);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should have rewards 2").to.equal(rew2);


        let balanceWndauBefore = await tokenWNDAU.balanceOf(user1);
        let balanceStakingWndauBefore = await tokenWNDAU.balanceOf(staking.address);          
        
        await staking.claim({from: user1});
        
        let balanceWndauAfter = await tokenWNDAU.balanceOf(user1);
        let balanceStakingWndauAfter = await tokenWNDAU.balanceOf(staking.address);
        
        expect((balanceWndauAfter.sub(balanceWndauBefore)).toNumber(), "Balance should increase 1").to.equal(rew1);
        expect((balanceStakingWndauBefore.sub(balanceStakingWndauAfter)).toNumber(), "Staking balance should decrease 1").to.equal(rew1);


        balanceWndauBefore = await tokenWNDAU.balanceOf(user2);
        balanceStakingWndauBefore = await tokenWNDAU.balanceOf(staking.address);          
        
        await staking.claim({from: user2});
        
        balanceWndauAfter = await tokenWNDAU.balanceOf(user2);
        balanceStakingWndauAfter = await tokenWNDAU.balanceOf(staking.address);
        
        expect((balanceWndauAfter.sub(balanceWndauBefore)).toNumber(), "Balance should increase 2").to.equal(rew2);
        expect((balanceStakingWndauBefore.sub(balanceStakingWndauAfter)).toNumber(), "Staking balance should decrease 2").to.equal(rew2);

        amountToAdd = rew1 + rew2;

      });

      it('Cannot claim again', async() => {
        expect((await staking.calculateUserRewards(user1)).toNumber(), "Should have rewards 1").to.equal(0);
        expect((await staking.calculateUserRewards(user2)).toNumber(), "Should have rewards 2").to.equal(0);



        let balanceWndauBefore = await tokenWNDAU.balanceOf(user1);
        let balanceStakingWndauBefore = await tokenWNDAU.balanceOf(staking.address);          
        
        await staking.claim({from: user1});
        
        let balanceWndauAfter = await tokenWNDAU.balanceOf(user1);
        let balanceStakingWndauAfter = await tokenWNDAU.balanceOf(staking.address);
        
        expect(balanceWndauBefore.toNumber(), "Balance should not increase 1").to.equal(balanceWndauAfter.toNumber());
        expect(balanceStakingWndauBefore.toNumber(), "Staking balance should not increase 1").to.equal(balanceStakingWndauAfter.toNumber());


        balanceWndauBefore = await tokenWNDAU.balanceOf(user2);
        balanceStakingWndauBefore = await tokenWNDAU.balanceOf(staking.address);          
        
        await staking.claim({from: user2});
        
        balanceWndauAfter = await tokenWNDAU.balanceOf(user2);
        balanceStakingWndauAfter = await tokenWNDAU.balanceOf(staking.address);
        
        expect(balanceWndauBefore.toNumber(), "Balance should not increase 2").to.equal(balanceWndauAfter.toNumber());
        expect(balanceStakingWndauBefore.toNumber(), "Staking balance should not increase 2").to.equal(balanceStakingWndauAfter.toNumber());

      });
    });

    describe('Return wNdau', () => {
        it('Return wNdau', async() => {
            let encodedData = staking.contract.methods.getWndau(signer1).encodeABI();

            await multisig.submitTransaction("Name", staking.address, 0, encodedData, { from: signer1 });
            await multisig.confirmTransaction(4, { from: signer2 });
            await multisig.confirmTransaction(4, { from: signer3 });

            expect((await tokenWNDAU.balanceOf(staking.address)).toNumber(), "Should be no tokens").to.equal(0);
        });
    });
});