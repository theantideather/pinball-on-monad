// Web3 connector for the pinball game
class Web3Connector {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.chainId = null;
        this.address = null;
        this.isMonad = false;
    this.isConnected = false;
        this.apiEndpoint = 'http://localhost:3000/api/mint-nft';
        this.contractInfoEndpoint = 'http://localhost:3000/api/contract-info';
  }

  /**
     * Initializes the connector
   */
    async initialize() {
    try {
            console.log("Initializing Web3 connector...");
            
            // Check if MetaMask or other web3 provider is available
      if (window.ethereum) {
                console.log("Web3 provider detected");
                this.provider = window.ethereum;
                
                // Listen for account changes
                this.provider.on('accountsChanged', (accounts) => {
                    console.log('Account changed:', accounts);
                    this.handleAccountsChanged(accounts);
                });
                
                // Listen for chain changes
                this.provider.on('chainChanged', (chainId) => {
                    console.log('Chain changed:', chainId);
                    window.location.reload();
                });
                
                // Try to auto-connect if previously connected
                this.autoConnect();
      } else {
                console.log("No web3 provider detected. Please install MetaMask.");
                this.displayInstallMetaMaskMessage();
      }
    } catch (error) {
            console.error("Error initializing Web3 connector:", error);
            this.displayErrorMessage("Failed to initialize wallet connection. Please refresh and try again.");
    }
  }

  /**
     * Display a message to install MetaMask
     */
    displayInstallMetaMaskMessage() {
        const walletStatus = document.getElementById('wallet-status');
        if (walletStatus) {
            walletStatus.innerHTML = `
                <span style="color: #e74c3c; font-weight: bold;">⚠ No Web3 wallet detected</span>
                <p>Please install <a href="https://metamask.io/" target="_blank" style="color: #2980b9;">MetaMask</a> to connect your wallet.</p>
            `;
        }
        
        // Disable connect button
        const connectButton = document.getElementById('connect-wallet-btn');
        if (connectButton) {
            connectButton.textContent = 'Install MetaMask';
            connectButton.addEventListener('click', () => {
                window.open('https://metamask.io/', '_blank');
            });
        }
    }
    
    /**
     * Display an error message
     * @param {string} message - Error message to display
     */
    displayErrorMessage(message) {
        const walletStatus = document.getElementById('wallet-status');
        if (walletStatus) {
            walletStatus.innerHTML = `<span style="color: #e74c3c;">⚠ ${message}</span>`;
        }
    }
    
    /**
     * Try to auto-connect if previously connected
     */
    async autoConnect() {
        try {
            console.log("Attempting auto-connect...");
            // Check if already connected
            const accounts = await this.provider.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                console.log("Found existing connected account");
                await this.handleAccountsChanged(accounts);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Auto-connect error:", error);
            return false;
        }
    }
    
    /**
     * Handle account changes
     * @param {Array} accounts - Array of account addresses 
     */
    async handleAccountsChanged(accounts) {
        try {
            if (accounts.length === 0) {
                this.address = null;
                this.isConnected = false;
                console.log("Disconnected from wallet");
                
                // Update UI for disconnected state
                this.updateUI();
            } else {
                this.address = accounts[0];
                this.isConnected = true;
                
                // Get chain ID
                this.chainId = await this.provider.request({ method: 'eth_chainId' });
                
                // Check if we're on Monad testnet (chain ID 10143 = 0x279f)
                this.isMonad = this.chainId === '0x279f' || this.chainId === '10143';
                
                console.log(`Connected to wallet: ${this.address}`);
                console.log(`Chain ID: ${this.chainId}, Is Monad: ${this.isMonad}`);
                
                // Update UI with connected state
                this.updateUI();
                
                // If not on Monad, prompt to switch
                if (!this.isMonad) {
                    setTimeout(() => {
                        this.promptSwitchToMonad();
                    }, 1000);
                }
            }
        } catch (error) {
            console.error("Error handling account change:", error);
            this.displayErrorMessage("Error connecting to wallet. Please try again.");
        }
    }
    
    /**
     * Prompt user to switch to Monad network
     */
    promptSwitchToMonad() {
        if (confirm("For the best experience, please switch to Monad Network. Switch now?")) {
            this.switchToMonad();
        }
    }
    
    /**
     * Connect to wallet
     * @returns {Promise<string>} Connected wallet address
     */
    async connect() {
        try {
            if (!this.provider) {
                console.error("No Web3 provider available");
                this.displayErrorMessage("No web3 wallet detected. Please install MetaMask.");
                return null;
            }
            
            console.log("Requesting wallet connection...");
            const accounts = await this.provider.request({ 
                method: 'eth_requestAccounts' 
            });
            
            await this.handleAccountsChanged(accounts);
            return this.address;
        } catch (error) {
            console.error("Error connecting to wallet:", error);
            
            // Handle specific error codes
            if (error.code === 4001) {
                // User rejected the connection request
                this.displayErrorMessage("Connection request was rejected. Please connect your wallet to continue.");
            } else {
                this.displayErrorMessage("Failed to connect wallet. Please try again.");
            }
            
            return null;
        }
    }
    
    /**
     * Switch to Monad network
     * @returns {Promise<boolean>} True if successful
     */
    async switchToMonad() {
        try {
            if (!this.provider) {
                console.error("No Web3 provider available");
                return false;
            }
            
            console.log("Attempting to switch to Monad network...");
            
            // Use correct ChainID in hex format
            const chainIdHex = '0x279f'; // 10143 in hex
            
            try {
                // Try to switch to Monad
                await this.provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: chainIdHex }]
                });
                console.log("Successfully switched to Monad network");
                return true;
            } catch (switchError) {
                console.log("Switch error:", switchError);
                
                // If network doesn't exist, add it
                if (switchError.code === 4902) {
                    console.log("Monad network not found, attempting to add it...");
                    try {
                        await this.provider.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: chainIdHex,
                                chainName: 'Monad Testnet',
                                nativeCurrency: {
                                    name: 'MONAD',
                                    symbol: 'MONAD',
                                    decimals: 18
                                },
                                rpcUrls: ['https://testnet-rpc.monad.xyz'],
                                blockExplorerUrls: ['https://explorer.monad.xyz/']
                            }]
                        });
                        console.log("Successfully added Monad network");
                        return true;
                    } catch (addError) {
                        console.error("Error adding Monad network:", addError);
                        this.displayErrorMessage("Failed to add Monad network. Please add it manually in your wallet.");
                        return false;
                    }
                } else if (switchError.code === 4001) {
                    // User rejected the request
                    this.displayErrorMessage("Network switch was rejected. Please switch to Monad network to continue.");
                    return false;
                } else {
                    console.error("Error switching to Monad:", switchError);
                    this.displayErrorMessage("Failed to switch to Monad network. Please try switching manually.");
                    return false;
                }
            }
        } catch (error) {
            console.error("Error in switchToMonad:", error);
            this.displayErrorMessage("An error occurred while switching networks. Please try again.");
            return false;
        }
    }
    
    /**
     * Check if wallet is connected
     * @returns {Boolean} True if connected
     */
    isWalletConnected() {
        return this.isConnected && this.address !== null;
    }
    
    /**
     * Get wallet address
     * @returns {String} Wallet address
     */
    getAddress() {
        return this.address;
    }
    
    /**
     * Get shortened wallet address
     * @returns {String} Shortened wallet address
     */
    getShortenedAddress() {
        if (!this.address) return null;
        return `${this.address.substring(0, 6)}...${this.address.substring(this.address.length - 4)}`;
    }
    
    /**
     * Update UI to reflect connection status
     */
    updateUI() {
        try {
            const connectButton = document.getElementById('connect-wallet-btn');
            const walletStatus = document.getElementById('wallet-status');
            const networkStatus = document.getElementById('network-status');
            const currentUser = document.getElementById('current-user');
            const walletAddressDisplay = document.getElementById('wallet-address');
            
            // Update connect button and wallet status
            if (connectButton && walletStatus) {
                if (this.isConnected) {
                    // Update connect button
                    connectButton.textContent = this.getShortenedAddress();
                    connectButton.classList.add('connected');
                    
                    // Update wallet status with success message
                    walletStatus.innerHTML = `
                        <span style="color: #4CAF50; font-weight: bold;">✓ Connected:</span> 
                        ${this.getShortenedAddress()}
                    `;
                    
                    // Update the player display if it exists
                    if (currentUser) {
                        currentUser.textContent = `Player: ${this.getShortenedAddress()}`;
                    }
                    
                    // Update wallet address display if it exists
                    if (walletAddressDisplay) {
                        walletAddressDisplay.textContent = `Wallet: ${this.getShortenedAddress()}`;
                    }
                    
                    // Update network status
                    if (networkStatus) {
                        if (this.isMonad) {
                            networkStatus.innerHTML = `
                                <span style="color: #4CAF50; font-weight: bold;">✓ Monad Network</span>
                            `;
                        } else {
                            networkStatus.innerHTML = `
                                <span style="color: #FF9800; font-weight: bold;">⚠ Not on Monad</span>
                                <button id="switch-network-button" class="btn btn-sm">Switch to Monad</button>
                            `;
                            
                            // Add click handler for switch button
                            const switchButton = document.getElementById('switch-network-button');
                            if (switchButton) {
                                switchButton.addEventListener('click', () => this.switchToMonad());
                            }
                        }
                    }
                    
                    // Enable mint button
                    const mintButton = document.getElementById('mint-nft-btn');
                    if (mintButton) {
                        mintButton.disabled = false;
                    }
                } else {
                    // Reset connect button
                    connectButton.textContent = 'Connect Wallet';
                    connectButton.classList.remove('connected');
                    
                    // Reset wallet status
                    walletStatus.textContent = 'Not connected';
                    
                    // Reset network status
                    if (networkStatus) {
                        networkStatus.textContent = 'Connect wallet to play';
                    }
                    
                    // Update the player display if it exists
                    if (currentUser) {
                        currentUser.textContent = 'Game in progress...';
                    }
                    
                    // Clear wallet address display if it exists
                    if (walletAddressDisplay) {
                        walletAddressDisplay.textContent = '';
                    }
                    
                    // Disable mint button
                    const mintButton = document.getElementById('mint-nft-btn');
                    if (mintButton) {
                        mintButton.disabled = true;
                    }
                }
            }
        } catch (error) {
            console.error("Error updating UI:", error);
        }
    }
    
    /**
     * Get contract information
     * @returns {Promise<Object>} Contract information
     */
    async getContractInfo() {
        try {
            console.log("Fetching contract info from API...");
            const response = await fetch(this.contractInfoEndpoint);
            const data = await response.json();
            console.log("Contract info response:", data);
            return data;
        } catch (error) {
            console.error("Error getting contract info:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Mint NFT
     * @param {Number} score - Player's score
     * @param {String} screenshot - Base64 encoded screenshot
     * @returns {Promise<Object>} Minting result
     */
    async mintNFT(score, screenshot) {
        try {
            console.log("Starting NFT minting process...");
            
      if (!this.isConnected) {
                console.error("Cannot mint: wallet not connected");
                throw new Error("Wallet not connected");
            }
            
            console.log("Wallet connected, preparing data for API...");
            
            // Prepare data for API
            const data = {
                playerAddress: this.address,
                username: this.getShortenedAddress() || "Anonymous",
                score: parseInt(score),
                screenshot: screenshot
            };
            
            // Call API
            console.log("Sending mint request to API...");
            const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                console.error(`Server responded with status: ${response.status}`);
                const errorText = await response.text();
                console.error(`Error response: ${errorText}`);
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log("Mint result:", result);
            
            // Add additional details to help with debugging
            if (!result.success) {
                console.error("Mint failed with server error:", result.error);
            } else {
                console.log("Mint successful:", {
                    tokenId: result.tokenId,
                    transactionHash: result.transactionHash,
                    ipfsUrl: result.ipfsUrl
                });
            }
            
            return result;
    } catch (error) {
            console.error("Error in mintNFT:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Get NFTs for the connected wallet
     * @returns {Promise<Array>} Array of NFTs
   */
    async getNFTs() {
    try {
      if (!this.isConnected) {
                console.log("Cannot fetch NFTs: wallet not connected");
                return [];
      }

            console.log("Fetching NFTs for address:", this.address);
            const response = await fetch(`/api/nfts?address=${this.address}`);
      const data = await response.json();

            if (data.success) {
                console.log("NFTs fetched successfully:", data.nfts);
                return data.nfts;
            } else {
                console.error("Error in NFT response:", data.error);
                return [];
            }
    } catch (error) {
            console.error("Error getting NFTs:", error);
      return [];
    }
  }
}

// Create and export singleton instance
const web3Connector = new Web3Connector();

// Initialize on page load
window.addEventListener('load', () => {
    console.log("Window loaded, initializing web3Connector...");
    web3Connector.initialize();
    
    // Add click handler for connect button
    const connectButton = document.getElementById('connect-wallet-btn');
    if (connectButton) {
        connectButton.addEventListener('click', async () => {
            if (!web3Connector.isWalletConnected()) {
                console.log("Connect button clicked, connecting wallet...");
                try {
                    // Update button state
                    connectButton.textContent = 'Connecting...';
                    connectButton.disabled = true;
                    
                    // Connect wallet
                    await web3Connector.connect();
                    
                    // Button state will be updated in handleAccountsChanged
                } catch (error) {
                    console.error("Error in connect button handler:", error);
                    connectButton.textContent = 'Connect Wallet';
                    connectButton.disabled = false;
                }
            }
        });
    }
});

// Expose to global scope
window.web3Connector = web3Connector; 