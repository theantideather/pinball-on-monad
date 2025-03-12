// Deploy PinballNFT contract to Monad blockchain
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import contract artifacts
const PinballNFT = require('./PinballNFT.json');

// Get environment variables
const {
  MONAD_RPC_URL,
  WALLET_PRIVATE_KEY,
  CHAIN_ID
} = process.env;

async function main() {
  try {
    console.log('Starting contract deployment to Monad testnet...');
    
    // Configure the provider
    const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
    
    // Create the wallet
    const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
    const address = await wallet.getAddress();
    console.log(`Deploying from address: ${address}`);
    
    // Check wallet balance
    const balance = await provider.getBalance(address);
    console.log(`Wallet balance: ${ethers.formatEther(balance)} MONAD`);
    
    if (balance === 0n) {
      throw new Error('Wallet has 0 balance. Please fund it with MONAD testnet tokens first.');
    }
    
    console.log('Creating contract factory...');
    const factory = new ethers.ContractFactory(
      PinballNFT.abi,
      PinballNFT.bytecode,
      wallet
    );
    
    console.log('Deploying contract...');
    const deployTx = await factory.getDeployTransaction();
    
    // Create a manual transaction with proper gas settings for Monad
    const tx = {
      data: deployTx.data,
      gasLimit: 5000000,
      maxFeePerGas: ethers.parseUnits('2', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei')
    };
    
    // Send the transaction
    console.log('Sending deployment transaction...');
    const response = await wallet.sendTransaction(tx);
    console.log(`Transaction hash: ${response.hash}`);
    
    console.log('Waiting for transaction confirmation...');
    const receipt = await response.wait();
    
    // Get the contract address
    const contractAddress = receipt.contractAddress;
    console.log(`Contract deployed to: ${contractAddress}`);
    
    // Update .env file with contract address
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Replace or add CONTRACT_ADDRESS
    if (envContent.includes('CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(/CONTRACT_ADDRESS=.*\n/, `CONTRACT_ADDRESS=${contractAddress}\n`);
    } else {
      envContent += `\nCONTRACT_ADDRESS=${contractAddress}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log(`Updated .env file with new contract address`);
    
    return {
      success: true,
      contractAddress,
      transactionHash: response.hash
    };
  } catch (error) {
    console.error('Error deploying contract:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(result => console.log('Deployment result:', result))
    .catch(error => console.error('Deployment failed:', error));
}

module.exports = { deployContract: main }; 