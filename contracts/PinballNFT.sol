// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title PinballNFT
 * @dev NFT contract for minting Space Cadet Pinball scores on Monad blockchain
 */
contract PinballNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    using Strings for uint256;
    
    // Token ID counter
    Counters.Counter private _tokenIds;
    
    // Mapping from tokenId to score
    mapping(uint256 => uint256) private tokenToScore;
    
    // Mapping from player to their tokens
    mapping(address => uint256[]) private playerTokens;
    
    // Base URI for metadata
    string private _baseTokenURI;
    
    // Fee amount in wei
    uint256 public mintFee = 0;
    
    // Store authorized minters
    mapping(address => bool) private _minters;
    
    // Events
    event ScoreMinted(address indexed player, uint256 tokenId, uint256 score);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event MintFeeUpdated(uint256 newFee);
    
    // Modifiers
    modifier onlyMinter() {
        require(_minters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _;
    }
    
    /**
     * @dev Constructor
     */
    constructor() ERC721("PinballScoreNFT", "PBALL") Ownable(msg.sender) {
        // Set up the owner as minter
        _minters[msg.sender] = true;
        emit MinterAdded(msg.sender);
    }
    
    /**
     * @dev Add a minter
     * @param minter Address to add as minter
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        _minters[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @dev Remove a minter
     * @param minter Address to remove as minter
     */
    function removeMinter(address minter) external onlyOwner {
        require(_minters[minter], "Not a minter");
        _minters[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev Check if an address is a minter
     * @param minter Address to check
     * @return bool True if the address is a minter
     */
    function isMinter(address minter) external view returns (bool) {
        return _minters[minter];
    }
    
    /**
     * @dev Set the mint fee
     * @param fee New fee amount
     */
    function setMintFee(uint256 fee) external onlyOwner {
        mintFee = fee;
        emit MintFeeUpdated(fee);
    }
    
    /**
     * @dev Set base URI for metadata
     * @param baseURI New base URI
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    /**
     * @dev Override base URI function
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev Withdraw contract balance
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev Mint a new score NFT for a player
     * @param player Player address
     * @param score Pinball score
     * @param tokenURI URI of the token metadata (IPFS URI)
     * @return uint256 New token ID
     */
    function mintScore(address player, uint256 score, string memory tokenURI) 
        public 
        payable 
        onlyMinter 
        returns (uint256) 
    {
        // Check fee if called by non-owner
        if (msg.sender != owner() && mintFee > 0) {
            require(msg.value >= mintFee, "Insufficient fee");
        }
        
        // Increment token ID
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        // Mint the token
        _mint(player, newTokenId);
        
        // Set token URI
        _setTokenURI(newTokenId, tokenURI);
        
        // Store score
        tokenToScore[newTokenId] = score;
        
        // Add to player's tokens
        playerTokens[player].push(newTokenId);
        
        // Emit event
        emit ScoreMinted(player, newTokenId, score);
        
        return newTokenId;
    }
    
    /**
     * @dev Get score for a token
     * @param tokenId Token ID
     * @return uint256 Score
     */
    function getScore(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "Token does not exist");
        return tokenToScore[tokenId];
    }
    
    /**
     * @dev Get tokens owned by a player
     * @param player Player address
     * @return uint256[] Array of token IDs
     */
    function getPlayerTokens(address player) external view returns (uint256[] memory) {
        return playerTokens[player];
    }
    
    /**
     * @dev Check if a token exists
     * @param tokenId Token ID
     * @return bool Token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return tokenId > 0 && tokenId <= _tokenIds.current() && _ownerOf(tokenId) != address(0);
    }
    
    /**
     * @dev Get total supply
     * @return uint256 Total number of tokens
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIds.current();
    }
    
    /**
     * @dev Get contract info (for frontend)
     * @return string Name
     * @return string Symbol
     * @return uint256 Total supply
     * @return uint256 Mint fee
     */
    function contractInfo() external view returns (string memory, string memory, uint256, uint256) {
        return (
            name(),
            symbol(),
            _tokenIds.current(),
            mintFee
        );
    }
} 