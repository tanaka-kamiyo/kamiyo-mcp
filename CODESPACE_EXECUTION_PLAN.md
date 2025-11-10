# Production MCP Server - Codespace Execution Plan

**For:** Claude Sonnet 4.5 Agent
**Repository:** https://github.com/tanaka-kamiyo/kamiyo-mcp
**Existing Program:** `E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n` (Solana Devnet)
**Estimated Time:** 6-8 hours focused implementation

---

## Mission

Build production-ready MCP server with full Solana/Anchor integration for x402Resolve. The Anchor program is already deployed on devnet at `E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n`. You will create the TypeScript client that allows AI agents (Claude) to interact with it via MCP protocol.

## Timeline Estimate

- **Phase 1** (2 hours): IDL extraction + Solana client layer
- **Phase 2** (2 hours): Anchor wrapper + transaction builders
- **Phase 3** (2 hours): MCP tools implementation
- **Phase 4** (1-2 hours): MCP server core + testing

**Total:** 6-8 hours

## Success Criteria

1. All 8 MCP tools working with real Solana transactions
2. Successful test transaction on devnet
3. MCP server passes protocol compliance test
4. Documentation complete with setup instructions

## Reference Materials

### Source Program Repository
```bash
git clone https://github.com/kamiyo-ai/x402resolve /tmp/x402resolve-reference
```

**Key files to reference:**
- `/tmp/x402resolve-reference/packages/x402-escrow/programs/x402-escrow/src/lib.rs` - Rust program source
- `/tmp/x402resolve-reference/packages/mcp-server/` - Existing Python MCP (reference only)
- `/tmp/x402resolve-reference/packages/x402-escrow/README.md` - Program documentation

### Program Structure
- **Program ID**: `E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n`
- **Network**: Solana Devnet
- **Instructions**:
  1. `initialize_escrow` - Create PDA escrow account
  2. `mark_disputed` - Mark escrow as disputed
  3. `resolve_dispute` - Resolve with oracle signature
  4. `release_funds` - Release funds to API provider
  5. `init_reputation` - Initialize reputation account
  6. `update_reputation` - Update reputation scores

### Account PDAs
```rust
// Escrow PDA
seeds = [b"escrow", transaction_id.as_bytes()]

// Reputation PDA
seeds = [b"reputation", entity.key().as_ref()]
```

---

## Execution Steps

### Step 1: Extract IDL from Source

**Task**: Generate Anchor IDL from the Rust program source.

```bash
cd /tmp/x402resolve-reference/packages/x402-escrow

# Option A: If anchor CLI is available
anchor build
cp target/idl/x402_escrow.json /workspace/src/idl/

# Option B: Manual IDL construction from lib.rs
# Read lib.rs and construct IDL JSON manually based on:
# - Program instructions (pub fn initialize_escrow, mark_disputed, etc.)
# - Account structures (#[account] pub struct Escrow, EntityReputation)
# - Enums (EscrowStatus, EntityType)
```

**Deliverable**: `/workspace/src/idl/x402_escrow.json` with complete program interface

**Validation**: IDL must match deployed program ID `E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n`

---

### Step 2: Implement Solana Client Layer

**Task**: Create TypeScript wrappers for Solana/Anchor interaction.

#### 2.1: PDA Derivation (`src/solana/pdas.ts`)

```typescript
import { PublicKey } from '@solana/web3.js';

export class PDADerivers {
  constructor(private programId: PublicKey) {}

  deriveEscrowPDA(transactionId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), Buffer.from(transactionId)],
      this.programId
    );
  }

  deriveReputationPDA(entity: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('reputation'), entity.toBuffer()],
      this.programId
    );
  }
}
```

#### 2.2: Anchor Program Client (`src/solana/anchor.ts`)

```typescript
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import idl from '../idl/x402_escrow.json';

export class X402Program {
  program: Program;

  constructor(
    connection: Connection,
    wallet: Keypair,
    programId: PublicKey
  ) {
    const provider = new AnchorProvider(connection, wallet, {});
    this.program = new Program(idl, programId, provider);
  }

  async initializeEscrow(params: {
    api: PublicKey;
    amount: number;
    timeLock: number;
    transactionId: string;
  }) {
    // Build and send initialize_escrow instruction
    // Return transaction signature
  }

  async markDisputed(escrowPDA: PublicKey) {
    // Build and send mark_disputed instruction
  }

  async resolveDispute(params: {
    escrowPDA: PublicKey;
    qualityScore: number;
    refundPercentage: number;
    oracleSignature: Buffer;
  }) {
    // Build and send resolve_dispute instruction with Ed25519 signature
  }

  async getEscrowAccount(escrowPDA: PublicKey) {
    // Fetch and deserialize escrow account
    return await this.program.account.escrow.fetch(escrowPDA);
  }

  async getReputationAccount(reputationPDA: PublicKey) {
    // Fetch and deserialize reputation account
    return await this.program.account.entityReputation.fetch(reputationPDA);
  }
}
```

#### 2.3: Transaction Builders (`src/solana/transactions.ts`)

```typescript
// Helper functions for building transaction instructions
// - buildInitializeEscrowIx
// - buildMarkDisputedIx
// - buildResolveDisputeIx
// - buildReleaseFundsIx
```

**Deliverables**:
- `src/solana/pdas.ts` - PDA derivation utilities
- `src/solana/anchor.ts` - Anchor program client wrapper
- `src/solana/transactions.ts` - Transaction builders
- `src/solana/client.ts` - RPC connection manager

**Validation**:
```bash
npm run build
# Should compile without errors
```

---

### Step 3: Implement MCP Tools

**Task**: Create MCP tool implementations that wrap Solana operations.

#### 3.1: Create Escrow Tool (`src/tools/escrow.ts`)

```typescript
import { z } from 'zod';

export const CreateEscrowSchema = z.object({
  api: z.string().describe('API provider wallet address'),
  amount: z.number().positive().describe('Payment amount in SOL'),
  timeLock: z.number().optional().describe('Escrow expiry in seconds'),
});

export async function createEscrow(
  params: z.infer<typeof CreateEscrowSchema>,
  program: X402Program
): Promise<{
  escrowAddress: string;
  transactionId: string;
  signature: string;
}> {
  // 1. Generate unique transaction ID
  // 2. Derive escrow PDA
  // 3. Call program.initializeEscrow()
  // 4. Wait for confirmation
  // 5. Return escrow details
}
```

#### 3.2: Check Escrow Status Tool (`src/tools/escrow.ts`)

```typescript
export const CheckEscrowSchema = z.object({
  escrowAddress: z.string().describe('Escrow PDA address'),
});

export async function checkEscrowStatus(
  params: z.infer<typeof CheckEscrowSchema>,
  program: X402Program
): Promise<{
  status: 'Active' | 'Disputed' | 'Resolved' | 'Released';
  agent: string;
  api: string;
  amount: number;
  qualityScore?: number;
  refundPercentage?: number;
}> {
  // 1. Parse escrow address
  // 2. Fetch escrow account
  // 3. Parse and return status
}
```

#### 3.3: Quality Assessment Tool (`src/tools/quality.ts`)

```typescript
export const AssessDataQualitySchema = z.object({
  apiResponse: z.record(z.unknown()).describe('API response JSON'),
  expectedCriteria: z.array(z.string()).describe('Quality criteria'),
});

export async function assessDataQuality(
  params: z.infer<typeof AssessDataQualitySchema>
): Promise<{
  qualityScore: number;
  refundPercentage: number;
  completeness: number;
  freshness: number;
  schemaCompliance: number;
  rationale: string;
}> {
  // Implement quality scoring algorithm
  // Match logic from existing Python oracle
  // Reference: /tmp/x402resolve-reference/packages/mcp-server/utils/quality_scorer.py
}
```

#### 3.4: File Dispute Tool (`src/tools/dispute.ts`)

```typescript
export const FileDisputeSchema = z.object({
  escrowAddress: z.string(),
  qualityScore: z.number().min(0).max(100),
  evidence: z.record(z.unknown()),
  refundPercentage: z.number().min(0).max(100),
});

export async function fileDispute(
  params: z.infer<typeof FileDisputeSchema>,
  program: X402Program
): Promise<{
  disputeId: string;
  status: 'pending_oracle';
  signature: string;
}> {
  // 1. Mark escrow as disputed
  // 2. Trigger oracle assessment
  // 3. Wait for oracle signature
  // 4. Call resolve_dispute with signature
  // 5. Return dispute resolution details
}
```

#### 3.5: Reputation Tool (`src/tools/reputation.ts`)

```typescript
export async function getApiReputation(
  params: { apiProvider: string },
  program: X402Program
): Promise<{
  reputationScore: number;
  totalTransactions: number;
  disputesFiled: number;
  disputesWon: number;
  disputesPartial: number;
  disputesLost: number;
  recommendation: 'trusted' | 'caution' | 'avoid';
}> {
  // Fetch reputation PDA and parse
}
```

#### 3.6: Unified Tool (`src/tools/unified.ts`)

```typescript
export async function callApiWithEscrow(
  params: {
    apiUrl: string;
    apiProvider: string;
    amount: number;
    expectedCriteria: string[];
  },
  program: X402Program
): Promise<{
  escrowAddress: string;
  apiResponse: unknown;
  qualityScore: number;
  refundAmount: number;
  finalStatus: string;
}> {
  // 1. Create escrow
  // 2. Call API with payment proof
  // 3. Assess quality
  // 4. File dispute if needed
  // 5. Return complete flow results
}
```

**Deliverables**:
- `src/tools/escrow.ts` - Escrow management tools
- `src/tools/quality.ts` - Quality assessment
- `src/tools/dispute.ts` - Dispute filing
- `src/tools/reputation.ts` - Reputation queries
- `src/tools/unified.ts` - Unified workflow
- `src/tools/index.ts` - Tool registry export

---

### Step 4: Implement MCP Server Core

**Task**: Create stdio-based MCP server following Anthropic's spec.

#### 4.1: Main Server (`src/index.ts`)

```typescript
import { Server } from '@anthropic-ai/sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as tools from './tools';

class KamiyoMCPServer {
  private server: Server;
  private program: X402Program;

  constructor() {
    // Load config from env
    const rpcUrl = process.env.SOLANA_RPC_URL!;
    const programId = new PublicKey(process.env.X402_PROGRAM_ID!);
    const keypair = Keypair.fromSecretKey(
      Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'base58')
    );

    // Initialize Solana client
    const connection = new Connection(rpcUrl);
    this.program = new X402Program(connection, keypair, programId);

    // Initialize MCP server
    this.server = new Server({
      name: 'kamiyo-x402',
      version: '1.0.0',
    });

    this.registerTools();
  }

  private registerTools() {
    // Register each tool with schema and handler
    this.server.tool('create_escrow', tools.CreateEscrowSchema,
      (params) => tools.createEscrow(params, this.program)
    );

    this.server.tool('check_escrow_status', tools.CheckEscrowSchema,
      (params) => tools.checkEscrowStatus(params, this.program)
    );

    // ... register remaining tools
  }

  async start() {
    // Start stdio-based server
    await this.server.start();
  }
}

// Entry point
const server = new KamiyoMCPServer();
server.start().catch(console.error);
```

#### 4.2: CLI Entry Point (`src/cli.ts`)

```typescript
#!/usr/bin/env node
import { KamiyoMCPServer } from './index';

async function main() {
  const server = new KamiyoMCPServer();
  await server.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**Deliverables**:
- `src/index.ts` - Main MCP server class
- `src/cli.ts` - CLI entry point
- `src/types/mcp.ts` - MCP protocol types
- `src/utils/logger.ts` - Structured logging
- `src/utils/errors.ts` - Error handling

---

### Step 5: Testing & Validation

#### 5.1: Unit Tests

```bash
# Test PDA derivation
npm test -- pdas.test.ts

# Test quality scoring
npm test -- quality.test.ts
```

#### 5.2: Integration Tests (Devnet)

```typescript
// tests/integration/create-escrow.test.ts
describe('Create Escrow', () => {
  it('should create escrow on devnet', async () => {
    const result = await createEscrow({
      api: TEST_API_PUBKEY,
      amount: 0.001,
    }, program);

    expect(result.escrowAddress).toBeDefined();
    expect(result.signature).toBeDefined();
  });
});
```

#### 5.3: MCP Protocol Test

```bash
# Test stdio communication
echo '{"method":"create_escrow","params":{"api":"...","amount":0.001}}' | node dist/cli.js
```

**Validation Checklist**:
- [ ] All TypeScript files compile without errors
- [ ] PDAs match expected addresses
- [ ] Can create escrow on devnet
- [ ] Can fetch escrow account data
- [ ] Quality assessment produces valid scores
- [ ] MCP server responds to tool calls via stdio

---

### Step 6: Documentation

#### 6.1: Update README

Add:
- Installation instructions
- Configuration guide
- Claude Desktop setup
- Example tool calls
- Troubleshooting section

#### 6.2: API Documentation

```bash
# Generate TypeDoc
npm install --save-dev typedoc
npx typedoc --out docs src/index.ts
```

#### 6.3: Claude Desktop Config Example

```json
{
  "mcpServers": {
    "kamiyo-x402": {
      "command": "node",
      "args": ["/path/to/kamiyo-mcp/dist/cli.js"],
      "env": {
        "SOLANA_RPC_URL": "https://api.devnet.solana.com",
        "X402_PROGRAM_ID": "E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n",
        "AGENT_PRIVATE_KEY": "<base58_keypair>"
      }
    }
  }
}
```

---

## Environment Setup

### Required Environment Variables

```bash
# .env.example
SOLANA_RPC_URL=https://api.devnet.solana.com
X402_PROGRAM_ID=E5EiaJhbg6Bav1v3P211LNv1tAqa4fHVeuGgRBHsEu6n
AGENT_PRIVATE_KEY=<base58_encoded_solana_keypair>
```

### Generate Test Keypair

```bash
solana-keygen new --no-bip39-passphrase -o /tmp/test-keypair.json
solana-keygen pubkey /tmp/test-keypair.json
# Use this for AGENT_PRIVATE_KEY (base58 encoded)
```

---

## Success Criteria

### Must Have
1. ✅ MCP server compiles and runs
2. ✅ Can create escrow on devnet
3. ✅ Can check escrow status
4. ✅ Can file dispute and resolve
5. ✅ Works with Claude Desktop

### Nice to Have
- Comprehensive error messages
- Retry logic for failed transactions
- Transaction simulation before sending
- Multi-oracle consensus support

---

## Common Issues & Solutions

### Issue: IDL Generation Fails
**Solution**: Manually construct IDL from Rust source. Focus on:
- Program ID
- Instruction names and parameters
- Account structures

### Issue: Transaction Fails with "Custom Program Error"
**Solution**: Check:
- PDA derivation matches program
- Account ordering in instruction
- Signer requirements

### Issue: MCP Server Not Responding
**Solution**: Verify:
- Stdio communication format
- JSON-RPC request structure
- Tool schemas match expected format

---

## Timeline Estimate

| Phase | Time | Description |
|-------|------|-------------|
| Step 1 | 1-2h | IDL extraction/generation |
| Step 2 | 2-3h | Solana client layer |
| Step 3 | 3-4h | MCP tools implementation |
| Step 4 | 1-2h | MCP server core |
| Step 5 | 2h | Testing & validation |
| Step 6 | 1h | Documentation |
| **Total** | **10-14h** | Full implementation |

---

## Final Deliverable

When complete, the repository should have:

```
kamiyo-mcp/
├── src/
│   ├── index.ts                 # MCP server entry
│   ├── cli.ts                   # CLI entry point
│   ├── idl/
│   │   └── x402_escrow.json    # Program IDL
│   ├── solana/
│   │   ├── client.ts           # RPC client
│   │   ├── pdas.ts             # PDA derivation
│   │   ├── anchor.ts           # Anchor wrapper
│   │   └── transactions.ts     # TX builders
│   ├── tools/
│   │   ├── escrow.ts           # Escrow tools
│   │   ├── quality.ts          # Quality assessment
│   │   ├── dispute.ts          # Dispute filing
│   │   ├── reputation.ts       # Reputation queries
│   │   ├── unified.ts          # Unified workflow
│   │   └── index.ts            # Tool registry
│   ├── types/
│   │   ├── mcp.ts              # MCP types
│   │   ├── solana.ts           # Solana types
│   │   └── x402.ts             # x402 types
│   └── utils/
│       ├── logger.ts           # Logging
│       ├── validation.ts       # Validation
│       └── errors.ts           # Error handling
├── tests/
│   ├── unit/
│   └── integration/
├── dist/                        # Compiled output
├── README.md                    # User documentation
├── IMPLEMENTATION_PLAN.md       # This file
├── package.json
├── tsconfig.json
└── .env.example

```

**Push to GitHub when complete:**
```bash
git add -A
git commit -m "Complete production MCP server implementation"
git push origin master
```

---

## Questions & Clarifications

If you encounter ambiguities:

1. **IDL mismatch**: Prioritize deployed program behavior over Rust source
2. **Oracle integration**: Use centralized oracle for MVP, note multi-oracle as TODO
3. **Error handling**: Fail fast with clear messages rather than silent failures
4. **Testing**: Focus on happy path first, edge cases second

---

## Contact

For questions or clarifications, refer to:
- x402resolve docs: https://github.com/kamiyo-ai/x402resolve
- MCP protocol: https://modelcontextprotocol.io
- Anchor docs: https://www.anchor-lang.com/docs

---

**Good luck! 🚀**
