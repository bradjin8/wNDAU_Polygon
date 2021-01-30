const tokenWNDAU = artifacts.require('wNDAU');

module.exports = function(deployer) {
  deployer.deploy(tokenWNDAU);
};
