// Pinball NFT Server - Handles API requests from the frontend
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { mintScoreNFT, getPlayerNFTs, getContractInfo } = require('./contracts/pinball-api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to allow requests from the frontend served on port 8080
app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// Middleware
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit for base64 images
app.use(express.static('public')); // Serve static files

// API Routes
app.post('/api/mint-nft', async (req, res) => {
  try {
    console.log('Received mint-nft request:', req.body.playerAddress);
    
    const { playerAddress, username, score, screenshot } = req.body;
    
    // Validate input
    if (!playerAddress || !username || !score || !screenshot) {
      console.error('Missing required fields:', { playerAddress: !!playerAddress, username: !!username, score: !!score, screenshot: !!screenshot });
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    console.log(`Processing mint request for ${playerAddress} with score ${score}`);
    
    // Mint NFT
    const result = await mintScoreNFT(playerAddress, username, score, screenshot);
    
    console.log('Mint result:', result);
    return res.json(result);
  } catch (error) {
    console.error('Error minting NFT:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/player-nfts/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate input
    if (!address) {
      return res.status(400).json({ success: false, error: 'Missing player address' });
    }
    
    // Get player NFTs
    const nfts = await getPlayerNFTs(address);
    
    return res.json(nfts);
  } catch (error) {
    console.error('Error getting player NFTs:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get contract info
app.get('/api/contract-info', async (req, res) => {
  try {
    const contractInfo = await getContractInfo();
    return res.json(contractInfo);
  } catch (error) {
    console.error('Error getting contract info:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  return res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Pinball NFT server running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/`);
}); 