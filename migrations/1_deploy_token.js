require('dotenv').config();

const Multisig = artifacts.require('MultiSigWallet');
const TokenWNDAU = artifacts.require('wNDAU');

module.exports = function(deployer) {
  let signs = process.env.MULTISIG_ADDRESSES.split(',');

  deployer.deploy(Multisig, signs).then(async function(){
    return await deployer.deploy(TokenWNDAU, Multisig.address);
  });
};
