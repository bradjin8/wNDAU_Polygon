const token_wNDAU = artifacts.require("wNDAU");

module.exports = function(deployer) {
  deployer.deploy(token_wNDAU);
};
