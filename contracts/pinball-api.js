// Pinball NFT API - Handles interaction with the blockchain
const { ethers } = require('ethers');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration from environment variables
const {
  MONAD_RPC_URL,
  WALLET_PRIVATE_KEY,
  IPFS_API_URL,
  IPFS_API_KEY,
  IPFS_API_SECRET,
  IPFS_JWT,
  CHAIN_ID,
  CONTRACT_ADDRESS: ENV_CONTRACT_ADDRESS
} = process.env;

// Use environment variable if available, otherwise use fallback
const CONTRACT_ADDRESS = ENV_CONTRACT_ADDRESS || "0xcd46E25F75e63Db6bFed8d92aAeb8Fe1F2e28cfd";

// Import contract ABI
const contractABI = [
  "function mintScore(address player, uint256 score, string memory tokenURI) payable returns (uint256)",
  "function getPlayerTokens(address player) view returns (uint256[])",
  "function getScore(uint256 tokenId) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function contractInfo() view returns (string, string, uint256, uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)"
];

// Initialize provider and contract 
let provider;
let wallet;
let contract;
let isSimulationMode = false;

// Try to initialize the contract, but don't crash if it fails
try {
  console.log("Initializing contract...");
  console.log(`Using RPC URL: ${MONAD_RPC_URL}`);
  console.log(`Contract address: ${CONTRACT_ADDRESS || "Not provided"}`);
  
  if (!MONAD_RPC_URL) {
    throw new Error("No RPC URL provided in environment variables");
  }
  
  provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
  
  if (!WALLET_PRIVATE_KEY) {
    throw new Error("No wallet private key provided in environment variables");
  }
  
  wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
  console.log(`Wallet address: ${wallet.address}`);
  
  if (!CONTRACT_ADDRESS) {
    console.log("No contract address provided. Using simulation mode.");
    isSimulationMode = true;
  } else {
    contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);
    console.log("Contract initialized successfully");
  }
} catch (error) {
  console.error("Failed to initialize contract:", error);
  console.log("Falling back to simulation mode");
  isSimulationMode = true;
}

// For tracking NFTs in memory when blockchain fails as a backup
const inMemoryNFTs = new Map(); // playerAddress -> array of NFTs

/**
 * Uploads image to IPFS using Pinata
 * @param {String} base64Image - Base64 encoded image data
 * @returns {Promise<String>} - IPFS hash
 */
async function uploadImageToIPFS(base64Image) {
  try {
    // Remove header from base64 data
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    console.log('Preparing image upload to IPFS...');
    
    // Create form data
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: 'pinball-score.png',
      contentType: 'image/png'
    });
    
    // Add metadata to help identify the file
    const metadata = JSON.stringify({
      name: `Pinball Score ${Date.now()}`,
      keyvalues: {
        game: 'Space Cadet Pinball',
        timestamp: new Date().toISOString()
      }
    });
    formData.append('pinataMetadata', metadata);
    
    // Set options for faster pinning
    const options = JSON.stringify({
      cidVersion: 0
    });
    formData.append('pinataOptions', options);
    
    // Use JWT authentication
    const headers = {
      'Authorization': `Bearer ${IPFS_JWT}`,
    };
    
    console.log('Uploading image to IPFS...');
    
    // Upload to Pinata
    const res = await axios.post(
      `${IPFS_API_URL}/pinning/pinFileToIPFS`,
      formData,
      {
        maxBodyLength: 'Infinity',
        headers: {
          ...headers,
          ...formData.getHeaders()
        }
      }
    );
    
    console.log('Image uploaded to IPFS', res.data.IpfsHash);
    
    return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
  } catch (error) {
    console.error('Error uploading image to IPFS:', error.message);
    // Fallback to a local URL for testing if IPFS fails
    return `https://via.placeholder.com/300x200?text=Pinball+Score+${Date.now()}`;
  }
}

/**
 * Uploads metadata to IPFS
 * @param {String} username - Player username
 * @param {Number} score - Player score
 * @param {String} imageUrl - IPFS URL of the image
 * @returns {Promise<String>} - IPFS hash of the metadata
 */
async function uploadMetadataToIPFS(username, score, imageUrl) {
  try {
    console.log('Preparing metadata for IPFS...');
    
    // Create metadata JSON
    const metadata = {
      name: `${username}'s Pinball Score`,
      description: `Score of ${score} points in Space Cadet Pinball`,
      image: imageUrl,
      attributes: [
        {
          trait_type: "Game",
          value: "Space Cadet Pinball"
        },
        {
          trait_type: "Score",
          value: score
        },
        {
          trait_type: "Player",
          value: username
        },
        {
          trait_type: "Date",
          value: new Date().toISOString().split('T')[0]
        }
      ]
    };
    
    // Use JWT authentication
    const headers = {
      'Authorization': `Bearer ${IPFS_JWT}`,
      'Content-Type': 'application/json'
    };
    
    console.log('Uploading metadata to IPFS...');
    
    // Upload to Pinata
    const res = await axios.post(
      `${IPFS_API_URL}/pinning/pinJSONToIPFS`,
      metadata,
      { headers }
    );
    
    console.log('Metadata uploaded to IPFS', res.data.IpfsHash);
    
    return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
  } catch (error) {
    console.error('Error uploading metadata to IPFS:', error.message);
    
    // Store metadata locally and return a placeholder URL
    const timestamp = Date.now();
    const fileName = `metadata-${timestamp}.json`;
    const filePath = path.join(__dirname, '..', 'public', 'metadata', fileName);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(metadata));
    
    return `/metadata/${fileName}`;
  }
}

/**
 * Mint an NFT for the player's score
 * @param {String} playerAddress - Ethereum address of the player
 * @param {String} username - Player's username
 * @param {Number} score - Player's score
 * @param {String} screenshot - Base64 encoded screenshot
 * @returns {Promise<Object>} - Minting result
 */
async function mintScoreNFT(playerAddress, username, score, screenshot) {
  try {
    console.log(`Minting NFT for ${playerAddress} with score ${score}`);
    
    // Upload screenshot to IPFS
    console.log('Uploading screenshot to IPFS...');
    const imageUrl = await uploadImageToIPFS(screenshot);
    console.log('Screenshot uploaded:', imageUrl);
    
    // Upload metadata to IPFS
    console.log('Creating and uploading metadata...');
    const metadataUrl = await uploadMetadataToIPFS(username, score, imageUrl);
    console.log('Metadata uploaded:', metadataUrl);
    
    if (isSimulationMode) {
      console.log('SIMULATION MODE: Generating simulated transaction data');
      
      // Generate a random token ID
      const tokenId = Math.floor(Date.now() / 1000);
      
      // Store in memory
      if (!inMemoryNFTs.has(playerAddress)) {
        inMemoryNFTs.set(playerAddress, []);
      }
      
      const nft = {
        tokenId,
        score,
        imageUrl,
        metadataUrl,
        timestamp: new Date().toISOString()
      };
      
      inMemoryNFTs.get(playerAddress).push(nft);
      
      // Return a simulated result
      return {
        success: true,
        tokenId,
        transactionHash: `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        ipfsUrl: metadataUrl,
        imageUrl,
        isSimulated: true,
        message: "NFT minted in simulation mode - no actual blockchain transaction"
      };
    }
    
    try {
      console.log('REAL MODE: Minting NFT on the blockchain...');
      console.log(`Using contract at: ${CONTRACT_ADDRESS}`);
      console.log(`Minting for address: ${playerAddress}`);
      console.log(`Score: ${score}`);
      console.log(`Metadata URL: ${metadataUrl}`);
      
      // Convert score to a number
      const scoreValue = ethers.toBigInt(score);
      
      // For debugging, get gas estimate
      const gasEstimate = await contract.mintScore.estimateGas(
        playerAddress,
        scoreValue,
        metadataUrl
      );
      console.log('Gas estimate:', gasEstimate.toString());
      
      // Call the mintScore function on the contract
      const tx = await contract.mintScore(
        playerAddress,
        scoreValue,
        metadataUrl
      );
      
      console.log('Transaction sent:', tx.hash);
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log('Transaction confirmed in block:', receipt.blockNumber);
      
      // Get the token ID from the event
      const event = receipt.logs.find(
        log => log.topics[0] === ethers.id("Transfer(address,address,uint256)")
      );
      
      let tokenId;
      if (event) {
        tokenId = ethers.toNumber(event.topics[3]);
        console.log('Token ID from event:', tokenId);
      } else {
        tokenId = Date.now(); // Fallback
        console.log('Could not find token ID in events, using fallback:', tokenId);
      }
      
      return {
        success: true,
        tokenId,
        transactionHash: tx.hash,
        ipfsUrl: metadataUrl,
        imageUrl,
        blockNumber: receipt.blockNumber,
        isSimulated: false
      };
    } catch (txError) {
      console.error('Transaction error:', txError);
      
      // Fall back to simulation if the transaction fails
      console.log('Falling back to simulation due to transaction error');
      
      // Generate a random token ID
      const tokenId = Math.floor(Date.now() / 1000);
      
      // Store in memory
      if (!inMemoryNFTs.has(playerAddress)) {
        inMemoryNFTs.set(playerAddress, []);
      }
      
      const nft = {
        tokenId,
        score,
        imageUrl,
        metadataUrl,
        timestamp: new Date().toISOString()
      };
      
      inMemoryNFTs.get(playerAddress).push(nft);
      
      return {
        success: true,
        tokenId,
        transactionHash: `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        ipfsUrl: metadataUrl,
        imageUrl,
        isSimulated: true,
        error: txError.message,
        message: "NFT minted in simulation mode due to transaction error"
      };
    }
  } catch (error) {
    console.error('Error minting NFT:', error);
    return {
      success: false,
      error: error.message,
      details: JSON.stringify(error, Object.getOwnPropertyNames(error))
    };
  }
}

/**
 * Get all NFTs owned by a player
 * @param {String} playerAddress - Player's Ethereum address
 * @returns {Promise<Array>} - Array of NFTs
 */
async function getPlayerNFTs(playerAddress) {
  try {
    console.log(`Getting NFTs for player ${playerAddress}`);
    
    // Check if we have in-memory NFTs for this player
    const memoryNFTs = inMemoryNFTs.get(playerAddress) || [];
    
    if (isSimulationMode) {
      console.log('SIMULATION MODE: Returning in-memory NFTs only');
      return {
        success: true,
        nfts: memoryNFTs,
        isSimulated: true
      };
    }
    
    // Try to get on-chain NFTs
    try {
      console.log('Getting on-chain NFTs...');
      const tokenIds = await contract.getPlayerTokens(playerAddress);
      console.log('Token IDs:', tokenIds);
      
      const nfts = await Promise.all(
        tokenIds.map(async (tokenId) => {
          try {
            const score = await contract.getScore(tokenId);
            const metadataUrl = await contract.tokenURI(tokenId);
            
            // Fetch metadata if it's a valid URL
            let metadata = {};
            if (metadataUrl.startsWith('http')) {
              try {
                const response = await axios.get(metadataUrl);
                metadata = response.data;
              } catch (err) {
                console.error(`Error fetching metadata for token ${tokenId}:`, err.message);
              }
            }
            
            return {
              tokenId: ethers.toNumber(tokenId),
              score: ethers.toNumber(score),
              metadataUrl,
              imageUrl: metadata.image || "",
              attributes: metadata.attributes || []
            };
          } catch (err) {
            console.error(`Error processing token ${tokenId}:`, err.message);
            return null;
          }
        })
      );
      
      // Filter out nulls and add in-memory NFTs
      const validNFTs = nfts.filter(nft => nft !== null);
      const combinedNFTs = [...validNFTs, ...memoryNFTs];
      
      // Sort by token ID (newest first)
      combinedNFTs.sort((a, b) => b.tokenId - a.tokenId);
      
      return {
        success: true,
        nfts: combinedNFTs,
        isSimulated: false
      };
    } catch (chainError) {
      console.error('Error getting on-chain NFTs:', chainError.message);
      console.log('Falling back to in-memory NFTs');
      
      return {
        success: true,
        nfts: memoryNFTs,
        isSimulated: true,
        error: chainError.message
      };
    }
  } catch (error) {
    console.error('Error getting player NFTs:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get contract information
 * @returns {Promise<Object>} - Contract information
 */
async function getContractInfo() {
  try {
    console.log('Getting contract information');
    
    if (isSimulationMode) {
      console.log('SIMULATION MODE: Returning simulated contract info');
      
      return {
        success: true,
        name: "Pinball Score NFT",
        symbol: "PINBALL",
        totalSupply: 0,
        contractAddress: CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000",
        isSimulated: true
      };
    }
    
    // Try to get real contract info
    try {
      const name = await contract.name();
      const symbol = await contract.symbol();
      
      // Get contract info
      const [contractName, contractSymbol, totalSupply, mintPrice] = await contract.contractInfo();
      
      return {
        success: true,
        name: name,
        symbol: symbol,
        totalSupply: totalSupply ? ethers.toNumber(totalSupply) : 0,
        mintPrice: mintPrice ? ethers.formatEther(mintPrice) : "0",
        contractAddress: CONTRACT_ADDRESS,
        isSimulated: false
      };
    } catch (chainError) {
      console.error('Error getting contract info:', chainError.message);
      
      // Fallback to simulated info
      return {
        success: true, 
        name: "Pinball Score NFT",
        symbol: "PINBALL",
        totalSupply: 0,
        contractAddress: CONTRACT_ADDRESS,
        isSimulated: true,
        error: chainError.message
      };
    }
  } catch (error) {
    console.error('Error getting contract info:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  mintScoreNFT,
  getPlayerNFTs,
  getContractInfo
}; 