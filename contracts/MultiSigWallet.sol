// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

contract MultiSigWallet is Context, ReentrancyGuard {

    event SignerChanged(address indexed previousSigner, address indexed newSigner);
    event Deposit(address indexed signer, uint256 value);
    event Withdraw(address indexed recepient, uint256 value);

    event TxSubmitted(address indexed signer, uint256 indexed transactionId);

    event TxConfirmed(address indexed signer, uint256 indexed transactionId);
    event TxConfirmationRevoked(address indexed signer, uint256 indexed transactionId);
    
    event TxExecuted(uint256 indexed transactionId);
    event TxExecutionFailed(uint256 indexed transactionId);
    
    
    /*
     *  Constants
     */
    uint256 constant MAX_SIGNERS = 15;
    uint256 constant THRESHOLD_SIGNERS = 5;


    /*
     *  Storage
     */
    mapping (uint => Transaction) public transactions;
    mapping (uint => mapping (address => bool)) public confirmations;
    mapping (address => bool) public isSigner;
    address[] public signers;

    uint public transactionCount;

    struct Transaction {
        address destination;
        uint value;
        bytes data;
        bool executed;
    }

    /*
     *  Modifiers
     */
    modifier onlyMultisig() {
        require(_msgSender() == address(this), "Not multisig");
        _;
    }

    modifier isNotSigner(address _account) {
        require(_account != address(0), "Zero address");
        require(!isSigner[_account], "Already a signer");
        _;
    }

    modifier isAllowedSigner(address _account) {
        require(isSigner[_account], "Is not a signer");
        _;
    }

    modifier transactionExists(uint256 transactionId) {
        require(transactions[transactionId].destination != address(0), "Incorrect id");
        _;
    }

    modifier confirmed(uint256 transactionId, address signer) {
        require(confirmations[transactionId][signer], "Not confirmed");
        _;
    }

    modifier notConfirmed(uint256 transactionId, address signer) {
        require(!confirmations[transactionId][signer], "Already confirmed");
        _;
    }

    modifier notExecuted(uint256 transactionId) {
        require(!transactions[transactionId].executed, "Already executed");
        _;
    }

    /// @dev Fallback function allows to deposit ether.
    receive() external payable
    {
        if (msg.value > 0)
            emit Deposit(msg.sender, msg.value);
    }

    /*
     * Public functions
     */
    /// @dev Contract constructor sets initial signers.
    /// @param _signers List of initial signers.
    constructor(address[] memory _signers) public
    {
        require(_signers.length == MAX_SIGNERS, "Incorrect signers number");
        signers = new address[](MAX_SIGNERS);
        for (uint256 i = 0; i < MAX_SIGNERS; i++) {
            require(_signers[i] != address(0), "Zero address");
            require(!isSigner[_signers[i]], "Signer already registered");
            isSigner[_signers[i]] = true;
            signers[i] = _signers[i];
        }

        transactionCount = 0;
    }

    /// @dev Allows to return a deposited ehter from the wallet.
    /// @param _recepient Address of the singer to receive the ether.
    /// @param _amount Amount of ether to be withdrawn.
    function returnDeposit(address payable _recepient, uint256 _amount) external onlyMultisig
        isAllowedSigner(_recepient)
    {
        require(_amount <= address(this).balance, "Incorrect amount");

        emit Withdraw(_recepient, _amount);
        _recepient.transfer(_amount);
    }

    /// @dev Allows to replace a signer with a new one. Transaction has to be sent by wallet.
    /// @param _previousSigner Address of the singer to be replaced.
    /// @param _newSigner Address of a new signer.
    function replaceSigner(address _previousSigner, address _newSigner) external onlyMultisig
        isAllowedSigner(_previousSigner)
        isNotSigner(_newSigner)
    {
        for (uint i = 0; i < MAX_SIGNERS; i++) {
            if (signers[i] == _previousSigner) {
                signers[i] = _newSigner;
                break;
            }
        }
        isSigner[_previousSigner] = false;
        isSigner[_newSigner] = true;

        emit SignerChanged(_previousSigner, _newSigner);
    }

    /// @dev Submits a transaction and confirms it (allowed for signers only).
    /// @param _destination Transaction target address.
    /// @param _ethValue Transaction ether value.
    /// @param _data Transaction data payload.
    /// @return transactionId Returns transaction ID.
    function submitTransaction(address _destination, uint256 _ethValue, bytes memory _data) external
        isAllowedSigner(_msgSender())
        returns (uint256 transactionId)
    {
        require(_destination != address(0), "Zero address");
        transactionId = transactionCount;

        transactions[transactionId] = Transaction({
            destination: _destination,
            value: _ethValue,
            data: _data,
            executed: false
        });

        transactionCount += 1;
        emit TxSubmitted(_msgSender(), transactionId);

        confirmTransaction(transactionId);
    }

    /// @dev Confirm a transaction (for signers only).
    /// @param transactionId Transaction ID.
    function confirmTransaction(uint256 transactionId) public
        isAllowedSigner(_msgSender())
        transactionExists(transactionId)
        notConfirmed(transactionId, _msgSender())
    {
        confirmations[transactionId][_msgSender()] = true;

        emit TxConfirmed(_msgSender(), transactionId);

        /// Execute the transaction if it is the last confirmation
        executeTransaction(transactionId);
    }

    /// @dev Allows a signer to revoke a confirmation for a transaction.
    /// @param transactionId Transaction ID.
    function revokeConfirmation(uint transactionId) external
        isAllowedSigner(_msgSender())
        transactionExists(transactionId)
        confirmed(transactionId, _msgSender())
        notExecuted(transactionId)
    {
        confirmations[transactionId][_msgSender()] = false;
        emit TxConfirmationRevoked(_msgSender(), transactionId);
    }

    /// @dev Executes a confirmed transaction (signers only).
    /// @param transactionId Transaction ID.
    function executeTransaction(uint transactionId) public nonReentrant
        isAllowedSigner(_msgSender())
        transactionExists(transactionId)
        confirmed(transactionId, _msgSender())
        notExecuted(transactionId)
    {
        if (isConfirmed(transactionId)) {
            if (external_call(transactionId)) {
                transactions[transactionId].executed = true;
                emit TxExecuted(transactionId);
            }
            else {
                emit TxExecutionFailed(transactionId);
            }
        }
    }

    function external_call(uint256 transactionId) internal returns (bool) {
        bool result;
        Transaction storage txn = transactions[transactionId];
        address destination = txn.destination;
        uint256 value = txn.value;
        bytes memory data =  txn.data;
        uint256 len = data.length;
        assembly {
            let x := mload(0x40)   // Memory for output
            let d := add(data, 32) // First 32 bytes are the padded length of data, so exclude that
            result := call(
                sub(gas(), 34710),   // 34710 is the value that solidity is currently emitting
                                   // It includes callGas (700) + callVeryLow (3) + callValueTransferGas (9000) +
                                   // callNewAccountGas (25000, if destination address does not exist)
                destination,
                value,
                d,
                len,        // Size of the input (in bytes) - this is what fixes the padding problem
                x,
                0                  // Output is ignored, therefore the output size is zero
            )
        }
        return result;
    }

    /// @dev Returns the confirmation status of a transaction.
    /// @param transactionId Transaction ID.
    /// @return Confirmation status.
    function isConfirmed(uint256 transactionId) public view returns (bool)
    {
        if (transactions[transactionId].executed) {
            return true;
        }

        uint256 count = 0;
        for (uint256 i = 0; i < MAX_SIGNERS; i++) {
            if (confirmations[transactionId][signers[i]])
                count += 1;
            if (count == THRESHOLD_SIGNERS)
                return true;
        }
        return false;
    }

    /// @dev Returns number of confirmations of a transaction.
    /// @param transactionId Transaction ID.
    /// @return count Number of confirmations.
    function getConfirmationCount(uint256 transactionId) external view returns (uint256 count)
    {
        if (transactions[transactionId].executed) {
            return THRESHOLD_SIGNERS;
        }

        for (uint256 i = 0; i < MAX_SIGNERS; i++)
            if (confirmations[transactionId][signers[i]])
                count += 1;
    }

    /// @dev Returns total number of pending transactions
    /// @return count Total number of transactions after filters are applied.
    function getPendingTransactionCount() external view returns (uint256 count)
    {
        for (uint256 i = 0; i < transactionCount; i++)
            if (!transactions[i].executed)
                count += 1;
    }

    /// @dev Returns list of signers.
    /// @return signers List of owner addresses.
    function getSigners() external view returns (address[] memory)
    {
        return signers;
    }

    /// @dev Returns array with signers addresses, which confirmed transaction.
    /// @param transactionId Transaction ID.
    /// @return _confirmations Returns array of signer addresses.
    function getConfirmations(uint256 transactionId) external view
        returns (address[] memory _confirmations)
    {
        address[] memory confirmationsTemp = new address[](MAX_SIGNERS);
        uint256 count = 0;
        uint i;
        for (i = 0; i < MAX_SIGNERS; i++)
            if (confirmations[transactionId][signers[i]]) {
                confirmationsTemp[count] = signers[i];
                count += 1;
            }
        _confirmations = new address[](count);
        for (i = 0; i < count; i++)
            _confirmations[i] = confirmationsTemp[i];
    }

    /// @dev Returns list of pending transaction IDs in defined range. (>= from and < to)
    /// @param from Index start position of transaction array.
    /// @param to Index end position of transaction array.
    /// @return _transactionIds Returns array of transaction IDs.
    function getPendingTransactionIds(uint256 from, uint256 to) external view
        returns (uint[] memory _transactionIds)
    {
        uint[] memory transactionIdsTemp = new uint[](transactionCount);
        uint count = 0;
        uint i;
        for (i = 0; i < transactionCount; i++)
            if ( !transactions[i].executed)
            {
                transactionIdsTemp[count] = i;
                count += 1;
            }

        if (to > transactionCount) {
            to = transactionCount;
        }
        _transactionIds = new uint[](to - from);
        for (i = from; i < to; i++)
            _transactionIds[i - from] = transactionIdsTemp[i];
    }
}