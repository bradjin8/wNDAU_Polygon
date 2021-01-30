const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider || 'ws://localhost:8545');
const { expect } = require('chai');
const timeMachine = require('ganache-time-traveler');

const WNDAU = artifacts.require('wNDAU');

describe.only('Testset for token properties', () => {
  let owner;
  let user1;
  let user2;

  let tokenWNDAU;
  let snapshotId;

  before(async() => {
    [
      owner,
      user1,
      user2
    ] = await web3.eth.getAccounts();

    tokenWNDAU = await WNDAU.new({ from: owner });
  });

  beforeEach(async() => {
    // Create a snapshot
    const snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot['result'];
  });

  afterEach(async() => await timeMachine.revertToSnapshot(snapshotId));

  describe('Token info', () => {

    it('Correct name', async() => {
      expect(await tokenWNDAU.name({ from: user1 })).to.equal('Wrapped NDAU');
    });

    it('Correct symbol', async() => {
      expect(await tokenWNDAU.symbol({ from: user2 })).to.equal('wNDAU');
    });

  });

});
