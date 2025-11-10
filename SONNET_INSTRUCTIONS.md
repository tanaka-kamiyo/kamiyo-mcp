# Instructions for Sonnet 4.5 Agent

You are working in a GitHub Codespace to implement the production MCP server. Follow this plan sequentially.

## Environment Setup

```bash
# Verify you're in the right place
pwd  # Should be /workspaces/kamiyo-mcp

# Install dependencies
npm install

# Install Solana CLI (for keypair generation)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Generate test keypair for devnet
solana-keygen new --outfile ~/.config/solana/agent-keypair.json --no-bip39-passphrase
solana config set --url https://api.devnet.solana.com

# Get keypair base58 for .env
AGENT_PUBKEY=$(solana-keygen pubkey ~/.config/solana/agent-keypair.json)
echo "Agent public key: $AGENT_PUBKEY"

# Airdrop devnet SOL for testing
solana airdrop 2 $AGENT_PUBKEY

# Create .env file
cat > .env << EOF
SOLANA_RPC_URL=https://api.devnet.solana.com
X402_PROGRAM_ID=E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n
AGENT_KEYPAIR_PATH=$HOME/.config/solana/agent-keypair.json
EOF

# Clone reference repo
git clone https://github.com/kamiyo-ai/x402resolve /tmp/x402resolve
```

## Implementation Sequence

### 1. Extract IDL (30 min)

The Rust program is at `/tmp/x402resolve/packages/x402-escrow/programs/x402-escrow/src/lib.rs`

**Task:** Create `src/idl/x402_escrow.json` by manually constructing the Anchor IDL from the Rust source.

**Key elements to extract:**
- Program ID: `E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n`
- Instructions: `initialize_escrow`, `mark_disputed`, `resolve_dispute`, `release_funds`, `init_reputation`
- Accounts: `Escrow`, `EntityReputation`, `RateLimiter`
- Types: `EscrowStatus`, `EntityType`, `VerificationLevel`

**Format:** Standard Anchor IDL JSON format (see Anchor docs)

### 2. Solana Client Layer (1 hour)

Create these files:

#### `src/solana/client.ts`
- Connection management
- Keypair loading from file or base58
- Balance checking
- Transaction confirmation

**Keypair loading:**
```typescript
import { readFileSync } from 'fs';

export function loadKeypair(pathOrBase58: string): Keypair {
  if (pathOrBase58.includes('/')) {
    // Load from file
    const data = JSON.parse(readFileSync(pathOrBase58, 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(data));
  } else {
    // Load from base58 string
    return Keypair.fromSecretKey(bs58.decode(pathOrBase58));
  }
}
```

#### `src/solana/pdas.ts`
```typescript
deriveEscrowPDA(transactionId: string): [PublicKey, number]
  seeds: ['escrow', transactionId]

deriveReputationPDA(entity: PublicKey): [PublicKey, number]
  seeds: ['reputation', entity]

deriveRateLimiterPDA(entity: PublicKey): [PublicKey, number]
  seeds: ['rate_limit', entity]
```

#### `src/solana/anchor.ts`
- Load IDL
- Create `Program<X402Escrow>` instance
- Type-safe method wrappers

#### `src/solana/transactions.ts`
Transaction builders for each instruction:
- `buildInitializeEscrow()`
- `buildMarkDisputed()`
- `buildResolveDispute()`
- `buildReleaseFunds()`
- `buildInitReputation()`

### 3. MCP Tools (2 hours)

Implement 8 tools in `src/tools/`:

#### `escrow.ts`
- `create_escrow` - Initialize escrow with amount/timelock
- `check_escrow_status` - Query escrow PDA state
- `verify_payment` - Confirm payment received

#### `quality.ts`
- `assess_data_quality` - Evaluate API response (off-chain)
- `estimate_refund` - Calculate refund by quality score

#### `dispute.ts`
- `file_dispute` - Mark escrow as disputed + submit to verifier

#### `reputation.ts`
- `get_api_reputation` - Query provider reputation PDA

#### `unified.ts`
- `call_api_with_escrow` - All-in-one: create + call + assess + resolve

**Tool format:** Each tool returns JSON:
```typescript
{
  success: boolean;
  result?: any;
  error?: string;
  signature?: string;  // For on-chain transactions
}
```

### 4. MCP Server Core (1.5 hours)

#### `src/index.ts`
Main MCP server implementing stdio protocol:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'kamiyo-x402',
  version: '1.0.0',
});

// Register all 8 tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Route to appropriate tool handler
});

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

#### `src/cli.ts`
CLI entry point:
```typescript
#!/usr/bin/env node
import { startServer } from './index.js';

startServer().catch(console.error);
```

Make executable: `chmod +x dist/cli.js`

### 5. Testing (1 hour)

#### Create test script `test-integration.ts`

```typescript
// 1. Check balance
// 2. Initialize reputation if needed
// 3. Create escrow (small amount: 0.01 SOL)
// 4. Query escrow status
// 5. Mark as disputed
// 6. Check reputation updated
```

Run: `npm run build && npx tsx test-integration.ts`

**Validation checklist:**
- [ ] Can create escrow on devnet
- [ ] Can query escrow PDA
- [ ] Can derive all PDAs correctly
- [ ] MCP tools return proper JSON
- [ ] Error handling works

### 6. Documentation (30 min)

Update `README.md` with:
- Setup instructions for Claude Desktop
- Environment variables needed
- Example MCP tool calls
- Troubleshooting section

Create `.env.example`:
```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
X402_PROGRAM_ID=E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n
AGENT_KEYPAIR_PATH=/path/to/keypair.json
```

**Note:** Keypair is already generated during environment setup

## Validation Commands

```bash
# Build
npm run build

# Test compilation
tsc --noEmit

# Run test
npx tsx test-integration.ts

# Test MCP protocol
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/cli.js
```

## Critical Implementation Notes

1. **PDA Seeds**: Must exactly match Rust program:
   - Escrow: `[b"escrow", transaction_id.as_bytes()]`
   - Reputation: `[b"reputation", entity.key()]`

2. **Transaction Signing**: Agent keypair must sign all transactions

3. **Error Handling**: Wrap all Solana errors in MCP-compliant format:
   ```typescript
   {
     content: [{
       type: "text",
       text: JSON.stringify({ success: false, error: message })
     }]
   }
   ```

4. **Devnet Only**: All transactions to `https://api.devnet.solana.com`

5. **IDL Version**: Must match deployed program (check lib.rs version comments)

## When You're Done

1. Commit all changes
2. Push to `tanaka-kamiyo/kamiyo-mcp`
3. Create summary document listing:
   - All files created
   - Test results
   - Example MCP tool invocations
   - Known limitations

## Resources

- MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Anchor TS: https://coral-xyz.github.io/anchor/ts/
- Solana Web3.js: https://solana-labs.github.io/solana-web3.js/
- Reference Python MCP: `/tmp/x402resolve/packages/mcp-server/`

## Estimated Timeline

Total: **6-8 hours** of focused implementation

If you get stuck, check the Python MCP reference implementation for logic examples.
