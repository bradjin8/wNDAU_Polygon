// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import "../MultiSigWallet.sol";

contract MultiSigWalletMock is MultiSigWallet {
    
    constructor(address[] memory _signers) public MultiSigWallet(_signers)
    {
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

    function executeTransactionMock(uint transactionId) public
    {
        this.executeTransaction(transactionId);
    }


}