// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import "../MultiSigWallet.sol";

interface TestMint {
    function mintFor(address recipient, uint256 amount) external;
    function burnFrom(address recipient, uint256 amount) external;
}
contract MultiSigWalletMock is MultiSigWallet {
    
    constructor(address[] memory _signers) public MultiSigWallet(_signers)
    {
    }

    function returnDepositMock(address payable _recipient, uint256 _amount) public
    {
        this.returnDeposit(_recipient, _amount);
    }

    function replaceSignerMock(address _previousSigner, address _newSigner) public
    {
        this.replaceSigner(_previousSigner, _newSigner);
    }

    function confirmTransactionMock(uint256 transactionId) public
    {
        this.confirmTransaction(transactionId);
    }

    function revokeConfirmationMock(uint transactionId) public
    {
        this.revokeConfirmation(transactionId);
    }

    function callToken(address token, address recipient, uint256 amount) public
    {
        TestMint(token).mintFor(recipient, amount);
    }

    function callBurn(address token, address recipient, uint256 amount) public
    {
        TestMint(token).burnFrom(recipient, amount);
    }


}