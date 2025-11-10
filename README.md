# KAMIYO MCP Server

Production-ready Model Context Protocol server for x402Resolve with full Solana/Anchor integration.

## Features

- **Real Solana Transactions**: Full web3 integration with transaction signing and submission
- **Anchor Program Integration**: Native support for x402Resolve Anchor program
- **MCP Protocol**: Implements Anthropic's Model Context Protocol for AI agent integration
- **8 Production Tools**: Complete toolkit for autonomous payment and dispute resolution
- **TypeScript**: Type-safe implementation with full IDE support

## Installation

```bash
npm install
npm run build
```

## Configuration

Create `.env` file:

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
X402_PROGRAM_ID=E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n
AGENT_PRIVATE_KEY=<base58_encoded_keypair>
```

## Usage

### As MCP Server

Configure in Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "kamiyo-x402": {
      "command": "node",
      "args": ["/path/to/kamiyo-mcp/dist/index.js"],
      "env": {
        "SOLANA_RPC_URL": "https://api.devnet.solana.com",
        "X402_PROGRAM_ID": "E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n"
      }
    }
  }
}
```

### Programmatic Usage

```typescript
import { KamiyoMCPServer } from '@kamiyo/mcp-server';

const server = new KamiyoMCPServer({
  rpcUrl: 'https://api.devnet.solana.com',
  programId: 'E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n',
  agentKeypair: keypair
});

await server.start();
```

## Available Tools

| Tool | Description |
|------|-------------|
| `create_escrow` | Create payment escrow with quality guarantee |
| `check_escrow_status` | Monitor escrow state and status |
| `assess_data_quality` | Evaluate API response quality |
| `file_dispute` | Submit dispute for poor quality data |
| `get_api_reputation` | Check provider trust score |
| `verify_payment` | Confirm payment received |
| `estimate_refund` | Calculate refund by quality score |
| `call_api_with_escrow` | Unified flow: create + call + assess |

## Architecture

```
src/
├── index.ts              # Main MCP server implementation
├── cli.ts                # CLI entry point
├── solana/
│   ├── client.ts         # Solana RPC client wrapper
│   ├── anchor.ts         # Anchor program interaction
│   ├── transactions.ts   # Transaction builders
│   └── pdas.ts          # PDA derivation utilities
├── tools/
│   ├── escrow.ts        # Escrow management tools
│   ├── quality.ts       # Quality assessment tools
│   ├── reputation.ts    # Reputation queries
│   └── unified.ts       # Unified workflow tool
├── types/
│   ├── mcp.ts           # MCP protocol types
│   ├── solana.ts        # Solana/Anchor types
│   └── x402.ts          # x402Resolve types
└── utils/
    ├── logger.ts        # Structured logging
    ├── validation.ts    # Input validation
    └── errors.ts        # Error handling
```

## Development

```bash
# Install dependencies
npm install

# Run in dev mode with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint and format
npm run lint
npm run format
```

## License

MIT | KAMIYO
