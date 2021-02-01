const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider || 'ws://localhost:8545');
const { expect } = require('chai');
const timeMachine = require('ganache-time-traveler');

const WNDAU = artifacts.require('wNDAU');
const MultiSigWallet = artifacts.require('MultiSigWallet');

describe.only('Testset for token properties', () => {
  let deployer;
  let signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8;
  let signer9, signer10, signer11, signer12, signer13, signer14, signer15;
  let user1, user2;

  let tokenWNDAU;
  let multisig;
  let snapshotId;

  before(async() => {
    [
      deployer,
      signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8,
      signer9, signer10, signer11, signer12, signer13, signer14, signer15,
      user1, user2
    ] = await web3.eth.getAccounts();

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

  describe('Token info', () => {

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

});
