// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import "../MultiSigWallet.sol";

interface TestMint {
    function mintFor(address recepient, uint256 amount) external;
}
contract MultiSigWalletMock is MultiSigWallet {
    
    constructor(address[] memory _signers) public MultiSigWallet(_signers)
    {
    }

    function returnDepositMock(address payable _recepient, uint256 _amount) public
    {
        this.returnDeposit(_recepient, _amount);
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

    function callToken(address token, address recepient, uint256 amount) public
    {
        TestMint(token).mintFor(recepient, amount);
    }


}