// SPDX-License-Identifier: AGPL V3.0
pragma solidity ^0.6.12;

interface IMultiSig { 
    function isSigner(address _recepient) external returns(bool);
}