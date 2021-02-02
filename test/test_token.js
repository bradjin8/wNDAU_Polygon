const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider || 'ws://localhost:8545');
const { expect } = require('chai');
const timeMachine = require('ganache-time-traveler');
const truffleAssert = require('truffle-assertions');

const WNDAU = artifacts.require('wNDAU');
const MultiSigWallet = artifacts.require('MultiSigWalletMock');

describe('Testset for token properties', () => {
  const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
  let deployer;
  let signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8;
  let signer9, signer10, signer11, signer12, signer13, signer14, signer15;
  let user1, user2;

  let tokenWNDAU;
  let multisig;
  let snapshotId;
  let signers_arr;

  before(async() => {
    [
      deployer,
      signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8,
      signer9, signer10, signer11, signer12, signer13, signer14, signer15,
      user1, user2
    ] = await web3.eth.getAccounts();
    signers_arr = [signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8, 
                   signer9, signer10, signer11, signer12, signer13, signer14, signer15];

    multisig = await MultiSigWallet.new([signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8, 
                                         signer9, signer10, signer11, signer12, signer13, signer14, signer15], { from: deployer });

    tokenWNDAU = await WNDAU.new(multisig.address, { from: deployer });

  });

  beforeEach(async() => {
    // Create a snapshot
    const snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot['result'];
  });

  afterEach(async() => await timeMachine.revertToSnapshot(snapshotId));

  describe('Multisig creation', () => {
    it('Accounts from constructor are signers', async() => {
      for (let i = 0; i < signers_arr.length; i++) {
        expect(await multisig.isSigner(signers_arr[i])).to.be.true;
      }
    });

    it('Not listed accounts are not signers', async() => {
        expect(await multisig.isSigner(user1)).to.be.false;
    });
    
    it('No transactions for the new multisig', async() => {
        expect((await multisig.transactionCount()).toNumber()).to.equal(0)
    });

    it('Number of signers matches the constant', async() => {
      for (let i = 0; i < 15; i++) {
        expect(await multisig.signers(i)).to.equal(signers_arr[i]);
      }
      await truffleAssert.fails(
        multisig.signers(15)
      );
    });

    it('Cannot create a multisig with incorrect signer address', async() => {
        ///Same signer1
        await truffleAssert.reverts(
            MultiSigWallet.new([signer1, signer1, signer3, signer4, signer5, signer6, signer7, signer8, 
                                signer9, signer10, signer11, signer12, signer13, signer14, signer15], { from: deployer }),
            "Signer already registered"
        );
        ///Null address
        await truffleAssert.reverts(
            MultiSigWallet.new([signer1, NULL_ADDRESS, signer3, signer4, signer5, signer6, signer7, signer8, 
                                signer9, signer10, signer11, signer12, signer13, signer14, signer15], { from: deployer }),
            "Zero address"
        );
        ///Incorrect length
        await truffleAssert.reverts(
            MultiSigWallet.new([signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8, 
                                signer9, signer10, signer11], { from: deployer }),
            "Incorrect signers number"
        );
        ///Incorrect length
        await truffleAssert.reverts(
            MultiSigWallet.new([signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8, 
                                signer9, signer10, signer11, signer12, signer13, signer14, signer15, user1], { from: deployer }),
            "Incorrect signers number"
        );

    });
  });

  describe('Token info', () => {
    it('Fails with incorrect multisisg address', async() => {
        await truffleAssert.reverts(
            WNDAU.new(NULL_ADDRESS, { from: deployer }),
            "Zero address"
          );
    });

    it('Correct name', async() => {
      expect(await tokenWNDAU.name()).to.equal('Wrapped NDAU');
    });

    it('Correct symbol', async() => {
      expect(await tokenWNDAU.symbol()).to.equal('wNDAU');
    });

    it('Correct decimals', async() => {
        expect((await tokenWNDAU.decimals()).toString()).to.equal('10');
    });

    it('No initial supply', async() => {
        expect((await tokenWNDAU.totalSupply()).toString()).to.equal('0');
    });
  });

  describe('Multisig replaceSigner()', () => {
    it('Only multisig can call the replaceSigner()', async() => {
        await truffleAssert.reverts(
            multisig.replaceSigner(signer1, user1, { from: user1 }),
            "Not multisig"
        );
        
        await truffleAssert.reverts(
            multisig.replaceSigner(signer1, user1, { from: signer1 }),
            "Not multisig"
        );
        
        await truffleAssert.passes(
            multisig.replaceSignerMock(signer1, user1, { from: deployer })
        );

    });
    it('Incorrect addresses for replaceSigner()', async() => {
        await truffleAssert.reverts(
            multisig.replaceSignerMock(NULL_ADDRESS, user1, { from: deployer }),
            "Is not a signer"
        );
        await truffleAssert.reverts(
            multisig.replaceSignerMock(user2, user1, { from: deployer }),
            "Is not a signer"
        );
        await truffleAssert.reverts(
            multisig.replaceSignerMock(signer1, signer2, { from: deployer }),
            "Already a signer"
        );
        await truffleAssert.reverts(
            multisig.replaceSignerMock(signer1, NULL_ADDRESS, { from: deployer }),
            "Zero address"
        );
    });

    it('Successful replaceSigner()', async() => {
        truffleAssert.eventEmitted(
            await multisig.replaceSignerMock(signer1, user1, { from: deployer }),
            'SignerChanged',
            {
                previousSigner: signer1,
                newSigner: user1
            }
        );
        
        expect(await multisig.isSigner(signer1)).to.be.false;
        expect(await multisig.isSigner(user1)).to.be.true;
        expect(await multisig.signers(0)).to.equal(user1);
    });

  });

  describe('Multisig submitTransaction()', () => {
    let replaceSignerEncoded;

    beforeEach(async() => {
        replaceSignerEncoded = multisig.contract.methods.replaceSigner(signer1, user1).encodeABI();
    });

    it('Only signers can call the submitTransaction()', async() => {
        await truffleAssert.fails(
            multisig.submitTransaction(multisig.address, 0, replaceSignerEncoded, { from: user1 }),
            "Is not a signer"
        );
    });

    it('Incorrect addresses for submitTransaction()', async() => {
        await truffleAssert.reverts(
            multisig.submitTransaction(NULL_ADDRESS, 0, replaceSignerEncoded, { from: signer1 }),
            "Zero address"
        );
    });

    it('Successful submitTransaction()', async() => {
        truffleAssert.eventEmitted(
            await multisig.submitTransaction(multisig.address, 0, replaceSignerEncoded, { from: signer1 }),
            'TxSubmitted', (ev) => { return ev.signer === signer1 && ev.transactionId.toString() == '0';}
        );
        
        expect((await multisig.transactionCount()).toNumber()).to.equal(1);

        let tr = await multisig.transactions(0);
        expect(tr.destination).to.equal(multisig.address);
        expect(tr.value.toNumber()).to.equal(0);
        expect(tr.data).to.equal(replaceSignerEncoded);
        expect(tr.executed).to.be.false;
    });

    it('Transaction confirmed after submitTransaction()', async() => {
        truffleAssert.eventEmitted(
            await multisig.submitTransaction(multisig.address, 0, replaceSignerEncoded, { from: signer1 }),
            'TxConfirmed', (ev) => { return ev.signer === signer1 && ev.transactionId.toString() == '0';}
        );
        
        expect((await multisig.transactionCount()).toNumber()).to.equal(1);

        expect(await multisig.confirmations(0, signer1) ).to.be.true;
    });
  });


  describe('Multisig for token', () => {
      

  });

});

//let replaceSignerEncoded = multisig.contract.methods.replaceSigner(signer1, user1).encodeABI();
//let mintForEncoded = tokenWNDAU.contract.methods.mintFor(user1, 10000).encodeABI();