const prompts = require('prompts');
const fs = require('fs');
const path = require('path');

let Web3 = require("web3");

const web3 = new Web3(Web3.givenProvider);


let MultiSigWallet = fs.readFileSync("./abi/MultiSigWallet.json").toString();
let multisig = new web3.eth.Contract(JSON.parse(MultiSigWallet));

let WNDAU = fs.readFileSync("./abi/wNDAU.json").toString();
let wndau = new web3.eth.Contract(JSON.parse(WNDAU));

const methodChoices = ["mintFor", "replaceSigner", "returnDeposit"];

const askQuestions = async() => {
    let encodedData;

    const { contractMethod } = await prompts([
    {
        type: 'select',
        name: 'contractMethod',
        message: 'Select a method to encode',
        choices: methodChoices,
        initial: 0
    }
    ]);

    if (contractMethod === 0) {
        const { receiver, amount } = await prompts([
        {
          type: 'text',
          name: 'receiver',
          message: 'Specify the receiver address',
          validate: addr => (
            /^0x[a-fA-F0-9]{40}$/g.test(addr) === false || // valid address
            /^0x[0]{40}$/g.test(addr) === true // non-zero address
          ) ?
            'Enter a valid non-zero Ethereum address' :
            true
        },
        {
          type: 'text',
          name: 'amount',
          message: 'Specify the tokens amount',
        }
      ]);

      console.log("Your arguments for the mintFor() transaction:");
      console.log("receiver: ", receiver);
      console.log("amount: ", amount);

      encodedData = wndau.methods.mintFor(receiver, amount).encodeABI();
    }
    else if (contractMethod === 1) {
        const { previousSigner, nextSigner } = await prompts([
        {
          type: 'text',
          name: 'previousSigner',
          message: 'Specify the previousSigner address',
          validate: addr => (
            /^0x[a-fA-F0-9]{40}$/g.test(addr) === false || // valid address
            /^0x[0]{40}$/g.test(addr) === true // non-zero address
          ) ?
            'Enter a valid non-zero Ethereum address' :
            true
        },
        {
            type: 'text',
            name: 'nextSigner',
            message: 'Specify the nextSigner address',
            validate: addr => (
              /^0x[a-fA-F0-9]{40}$/g.test(addr) === false || // valid address
              /^0x[0]{40}$/g.test(addr) === true // non-zero address
            ) ?
              'Enter a valid non-zero Ethereum address' :
              true
          }
      ]);

      console.log("Your arguments for the replaceSigner() transaction:");
      console.log("previousSigner: ", previousSigner);
      console.log("nextSigner: ", nextSigner);

      encodedData = multisig.methods.replaceSigner(previousSigner, nextSigner).encodeABI();
    }
    else {
        const { receiver, amount } = await prompts([
            {
              type: 'text',
              name: 'receiver',
              message: 'Specify the receiver address',
              validate: addr => (
                /^0x[a-fA-F0-9]{40}$/g.test(addr) === false || // valid address
                /^0x[0]{40}$/g.test(addr) === true // non-zero address
              ) ?
                'Enter a valid non-zero Ethereum address' :
                true
            },
            {
              type: 'text',
              name: 'amount',
              message: 'Specify the ETH amount',
            }
          ]);
    
          console.log("Your arguments for the returnDeposit() transaction:");
          console.log("receiver: ", receiver);
          console.log("amount: ", amount);
    
          encodedData = multisig.methods.returnDeposit(receiver, amount).encodeABI();
    }
    console.log('Your data: ');
    console.log(encodedData);

    return {encodedData};
}


(async() => {
    const { encodedData } = await askQuestions();
  })();