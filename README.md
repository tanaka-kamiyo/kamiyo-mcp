# KAMIYO x402 MCP Server

Production-ready Model Context Protocol server for x402Resolve with full Solana/Anchor integration. Enables AI agents like Claude to make protected API payments with automatic quality assessment and dispute resolution.

## Features

- **Real Solana Transactions**: Full web3 integration with transaction signing and submission
- **Anchor Program Integration**: Native support for x402Resolve Anchor program (`E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n`)
- **MCP Protocol**: Implements Anthropic's Model Context Protocol for AI agent integration
- **8 Production Tools**: Complete toolkit for autonomous payment and dispute resolution
- **TypeScript**: Type-safe implementation with full IDE support
- **Quality Assessment**: Off-chain quality scoring with on-chain dispute resolution

## Quick Start

### 1. Installation

```bash
git clone https://github.com/tanaka-kamiyo/kamiyo-mcp.git
cd kamiyo-mcp
npm install
npm run build
```

### 2. Configuration

Create a `.env` file in the project root:

```bash
# Solana RPC endpoint (devnet recommended for testing)
SOLANA_RPC_URL=https://api.devnet.solana.com

# x402Resolve program ID (deployed on Solana devnet)
X402_PROGRAM_ID=E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n

# Agent wallet private key (base58 encoded)
# Generate one with: solana-keygen new --no-bip39-passphrase
AGENT_PRIVATE_KEY=<your_base58_private_key>
```

### 3. Generate a Keypair (if you don't have one)

```bash
# Install Solana CLI if not already installed
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate a new keypair
solana-keygen new --no-bip39-passphrase -o agent-keypair.json

# Get the public key
solana-keygen pubkey agent-keypair.json

# Get base58 private key for .env
# (Read the JSON file and base58 encode the array)
```

Or use this Node.js script to generate a keypair:

```javascript
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const keypair = Keypair.generate();
console.log('Public Key:', keypair.publicKey.toBase58());
console.log('Private Key (base58):', bs58.encode(keypair.secretKey));
```

### 4. Fund Your Wallet (Devnet)

```bash
# Request airdrop
solana airdrop 2 <your_public_key> --url devnet
```

### 5. Run the MCP Server

```bash
npm start
```

## Usage with Claude Desktop

Configure the MCP server in Claude Desktop's config file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kamiyo-x402": {
      "command": "node",
      "args": ["/absolute/path/to/kamiyo-mcp/dist/index.js"],
      "env": {
        "SOLANA_RPC_URL": "https://api.devnet.solana.com",
        "X402_PROGRAM_ID": "E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n",
        "AGENT_PRIVATE_KEY": "<your_base58_private_key>"
      }
    }
  }
}
```

Restart Claude Desktop, and the x402 tools will be available.

## Available Tools

### 1. `create_escrow`
Create a payment escrow for an API call with quality guarantee.

**Parameters:**
- `api` (string): API provider wallet address
- `amount` (number): Payment amount in SOL (minimum 0.001 SOL)
- `timeLock` (number, optional): Escrow expiry in seconds (default: 3600, max: 2592000)

**Example:**
```json
{
  "api": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "amount": 0.1,
  "timeLock": 7200
}
```

### 2. `check_escrow_status`
Check the status and details of an escrow account.

**Parameters:**
- `escrowAddress` OR `transactionId` (string): Escrow PDA or transaction ID

**Returns:** Escrow status (Active/Disputed/Resolved/Released), amounts, timestamps, quality scores

### 3. `verify_payment`
Verify that payment was received and escrow is active.

**Parameters:**
- `transactionId` (string): Transaction ID of the escrow

### 4. `assess_data_quality`
Assess the quality of API response data (off-chain).

**Parameters:**
- `apiResponse` (object): API response JSON
- `expectedCriteria` (array): Expected fields (e.g., ["data.name", "data.price"])

**Returns:** Quality score (0-100), refund percentage, completeness, freshness, schema compliance

### 5. `estimate_refund`
Estimate refund amount based on quality score.

**Parameters:**
- `amount` (number): Original payment in SOL
- `qualityScore` (number): Quality score (0-100)

### 6. `file_dispute`
File a dispute for poor quality API data.

**Parameters:**
- `transactionId` (string): Transaction ID
- `qualityScore` (number): Quality assessment score
- `refundPercentage` (number): Requested refund (0-100)
- `evidence` (object): Supporting evidence

### 7. `get_api_reputation`
Get reputation score and history for an API provider.

**Parameters:**
- `apiProvider` (string): API provider wallet address

**Returns:** Reputation score (0-1000), transaction count, dispute history, recommendation

### 8. `call_api_with_escrow` (Recommended)
Unified workflow: Create escrow → Call API → Assess quality → Auto-dispute if needed.

**Parameters:**
- `apiUrl` (string): API endpoint URL
- `apiProvider` (string): API provider wallet
- `amount` (number): Payment in SOL
- `expectedCriteria` (array, optional): Expected response fields
- `autoDispute` (boolean, optional): Auto-file dispute if quality low (default: true)
- `qualityThreshold` (number, optional): Quality threshold for auto-dispute (default: 50)

**Example Usage in Claude:**
```
Can you call the API at https://api.example.com/data with escrow payment of 0.05 SOL to provider 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU?
```

## Architecture

```
src/
├── index.ts              # Main MCP server implementation
├── cli.ts                # CLI entry point
├── idl/
│   └── x402_escrow.json # Anchor program IDL
├── solana/
│   ├── client.ts         # Solana RPC client wrapper
│   ├── anchor.ts         # Anchor program interaction
│   ├── transactions.ts   # Transaction builders
│   └── pdas.ts          # PDA derivation utilities
└── tools/
    ├── escrow.ts        # Escrow management tools
    ├── quality.ts       # Quality assessment tools
    ├── dispute.ts       # Dispute filing tools
    ├── reputation.ts    # Reputation queries
    ├── unified.ts       # Unified workflow tool
    └── index.ts         # Tool exports
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Run in development mode with hot reload
npm run dev

# Lint code
npm run lint

# Format code
npm run format
```

## Testing

```bash
# Run tests
npm test

# Test MCP protocol compliance
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js
```

## Troubleshooting

### "Failed to parse AGENT_PRIVATE_KEY"
- Ensure your private key is base58 encoded
- Use the full 88-character base58 string from the Solana keypair

### "Insufficient funds"
- Request devnet airdrop: `solana airdrop 2 <your_address> --url devnet`
- Check balance: `solana balance <your_address> --url devnet`

### "Program E5Eia... not found"
- Ensure you're connected to Solana devnet
- Verify X402_PROGRAM_ID in .env matches: `E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n`

### "Account does not exist"
- Initialize reputation account first using `init_reputation` (done automatically when filing disputes)
- Ensure escrow was created successfully before checking status

## Security Considerations

- **Private Keys**: Never commit `.env` to version control
- **Devnet Only**: Current implementation uses Solana devnet. For mainnet, audit all code and increase security measures
- **Dispute Costs**: Filing disputes has a cost that increases with abuse patterns (see reputation system)

## Contributing

Contributions welcome! Please open issues or pull requests on GitHub.

## Resources

- [x402Resolve GitHub](https://github.com/kamiyo-ai/x402resolve)
- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)

## License

MIT | KAMIYO
