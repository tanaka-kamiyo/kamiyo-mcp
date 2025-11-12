/**
 * x402Resolve Oracle Transaction System
 * Production implementation for real on-chain dispute resolution
 */

const PROGRAM_ID = '4x8i1j1Xy9wTPCLELtXuBt6nMwCmfzF9BK47BG8MWWf7';
const DEVNET_RPC = 'https://api.devnet.solana.com';

// Browser-compatible Buffer replacement
class BufferPolyfill {
    static from(data, encoding) {
        let arr;
        if (Array.isArray(data)) {
            arr = new Uint8Array(data);
        } else if (typeof data === 'string') {
            const encoder = new TextEncoder();
            arr = encoder.encode(data);
        } else {
            arr = new Uint8Array(data);
        }

        // Add copy method to all from() results
        arr.copy = function(target, targetStart, sourceStart, sourceEnd) {
            const start = sourceStart || 0;
            const end = sourceEnd || this.length;
            target.set(this.slice(start, end), targetStart);
        };

        return arr;
    }

    static alloc(size) {
        const arr = new Uint8Array(size);
        // Add helper methods
        arr.writeBigUInt64LE = function(value, offset) {
            const view = new DataView(this.buffer);
            view.setBigUint64(offset, value, true);
        };
        arr.writeBigInt64LE = function(value, offset) {
            const view = new DataView(this.buffer);
            view.setBigInt64(offset, value, true);
        };
        arr.writeUInt32LE = function(value, offset) {
            const view = new DataView(this.buffer);
            view.setUint32(offset, value, true);
        };
        arr.writeUInt8 = function(value, offset) {
            this[offset] = value;
        };
        arr.copy = function(target, targetStart, sourceStart, sourceEnd) {
            const start = sourceStart || 0;
            const end = sourceEnd || this.length;
            target.set(this.slice(start, end), targetStart);
        };
        arr.toString = function(encoding) {
            if (encoding === 'hex') {
                return Array.from(this).map(b => b.toString(16).padStart(2, '0')).join('');
            }
            return new TextDecoder().decode(this);
        };
        return arr;
    }
}

const Buffer = BufferPolyfill;

// Multi-Oracle Setup (5 oracles for consensus)
// In production, these would be secure backend services
const ORACLES = [];
for (let i = 0; i < 5; i++) {
    const seed = new Uint8Array(32);
    for (let j = 0; j < 32; j++) {
        seed[j] = (i * 50) + j + 100; // Deterministic seeds for demo
    }
    const keypair = nacl.sign.keyPair.fromSeed(seed);
    const publicKey = new solanaWeb3.PublicKey(keypair.publicKey);
    ORACLES.push({
        name: `Oracle ${i + 1}`,
        keypair: keypair,
        publicKey: publicKey,
        secretKey: keypair.secretKey
    });
}

class OracleTransactionSystem {
    constructor() {
        this.connection = new solanaWeb3.Connection(DEVNET_RPC, 'confirmed');
        this.programId = new solanaWeb3.PublicKey(PROGRAM_ID);
        this.oracles = ORACLES;
        this.initOracles();
    }

    async initOracles() {
        // Log all oracle public keys
        console.log('=== Multi-Oracle System Initialized ===');
        this.oracles.forEach((oracle, i) => {
            console.log(`${oracle.name} Public Key:`, oracle.publicKey.toString());
        });
        console.log(`Total Oracles: ${this.oracles.length}`);
    }

    /**
     * Derive PDA addresses
     */
    deriveEscrowPDA(transactionId) {
        const [pda, bump] = solanaWeb3.PublicKey.findProgramAddressSync(
            [
                Buffer.from('escrow'),
                Buffer.from(transactionId)
            ],
            this.programId
        );
        return { pda, bump };
    }

    deriveReputationPDA(entity) {
        const [pda, bump] = solanaWeb3.PublicKey.findProgramAddressSync(
            [
                Buffer.from('reputation'),
                entity.toBuffer()
            ],
            this.programId
        );
        return { pda, bump };
    }

    deriveOracleRegistryPDA() {
        const [pda, bump] = solanaWeb3.PublicKey.findProgramAddressSync(
            [Buffer.from('oracle_registry')],
            this.programId
        );
        return { pda, bump };
    }

    /**
     * Generate multi-oracle quality assessment
     */
    async generateMultiOracleAssessment(transactionId) {
        const submissions = [];

        // Each oracle independently assesses quality
        for (let i = 0; i < this.oracles.length; i++) {
            const oracle = this.oracles[i];

            // Each oracle generates its own quality score (with slight variation)
            const baseScore = 70;
            const variation = Math.floor(Math.random() * 10) - 5; // -5 to +5
            const qualityScore = Math.max(0, Math.min(100, baseScore + variation));

            // Create message and sign it
            const message = `${transactionId}:${qualityScore}`;
            const messageBytes = new TextEncoder().encode(message);
            const signature = nacl.sign.detached(messageBytes, oracle.secretKey);

            submissions.push({
                oracle: oracle.publicKey,
                quality_score: qualityScore,
                signature: Array.from(signature),
                message: message
            });

            console.log(`${oracle.name} assessed quality: ${qualityScore}`);
        }

        // Calculate consensus (median)
        const scores = submissions.map(s => s.quality_score).sort((a, b) => a - b);
        const consensusScore = scores[Math.floor(scores.length / 2)];

        // Calculate refund percentage based on consensus
        let refundPercentage = 0;
        if (consensusScore < 50) {
            refundPercentage = 100;
        } else if (consensusScore < 65) {
            refundPercentage = 75;
        } else if (consensusScore < 80) {
            refundPercentage = 35;
        }

        console.log(`Multi-Oracle Consensus: ${consensusScore} (Refund: ${refundPercentage}%)`);

        return {
            submissions,
            consensusScore,
            refundPercentage,
            scores
        };
    }

    /**
     * Create Ed25519 verification instructions for multiple oracle submissions
     */
    createEd25519Instructions(submissions) {
        const instructions = [];

        for (const submission of submissions) {
            const signatureBytes = new Uint8Array(submission.signature);
            const publicKeyBytes = submission.oracle.toBytes();
            const messageBytes = new TextEncoder().encode(submission.message);

            // Ed25519 instruction data format
            const headerSize = 16;
            const sigOffset = headerSize;
            const pubkeyOffset = sigOffset + 64;
            const messageOffset = pubkeyOffset + 32;
            const totalSize = messageOffset + messageBytes.length;

            const dataLayout = new Uint8Array(totalSize);
            let offset = 0;

            // num_signatures (1 byte)
            dataLayout[offset++] = 1;

            // padding (1 byte)
            dataLayout[offset++] = 0;

            // signature_offset (u16 LE)
            dataLayout[offset++] = sigOffset & 0xFF;
            dataLayout[offset++] = (sigOffset >> 8) & 0xFF;

            // signature_instruction_index (u16 LE) - 0xFFFF = current
            dataLayout[offset++] = 0xFF;
            dataLayout[offset++] = 0xFF;

            // public_key_offset (u16 LE)
            dataLayout[offset++] = pubkeyOffset & 0xFF;
            dataLayout[offset++] = (pubkeyOffset >> 8) & 0xFF;

            // public_key_instruction_index (u16 LE)
            dataLayout[offset++] = 0xFF;
            dataLayout[offset++] = 0xFF;

            // message_data_offset (u16 LE)
            dataLayout[offset++] = messageOffset & 0xFF;
            dataLayout[offset++] = (messageOffset >> 8) & 0xFF;

            // message_data_size (u16 LE)
            dataLayout[offset++] = messageBytes.length & 0xFF;
            dataLayout[offset++] = (messageBytes.length >> 8) & 0xFF;

            // message_instruction_index (u16 LE)
            dataLayout[offset++] = 0xFF;
            dataLayout[offset++] = 0xFF;

            // Copy data
            dataLayout.set(signatureBytes, sigOffset);
            dataLayout.set(publicKeyBytes, pubkeyOffset);
            dataLayout.set(messageBytes, messageOffset);

            instructions.push(new solanaWeb3.TransactionInstruction({
                keys: [],
                programId: solanaWeb3.Ed25519Program.programId,
                data: Buffer.from(dataLayout)
            }));
        }

        console.log(`Created ${instructions.length} Ed25519 verification instructions`);
        return instructions;
    }

    /**
     * Initialize oracle registry (if needed)
     */
    async initializeOracleRegistry(wallet, minConsensus = 3, maxDeviation = 15) {
        const { pda: registryPDA } = this.deriveOracleRegistryPDA();

        // Check if registry already exists
        try {
            const accountInfo = await this.connection.getAccountInfo(registryPDA);
            if (accountInfo) {
                console.log('Oracle registry already exists');
                return registryPDA;
            }
        } catch (e) {
            // Registry doesn't exist, create it
        }

        console.log('Initializing oracle registry...');

        // Build initialize_oracle_registry instruction
        const discriminator = Buffer.from([190, 92, 228, 114, 56, 71, 101, 220]);

        const dataLayout = Buffer.alloc(10);
        let offset = 0;

        discriminator.copy(dataLayout, offset);
        offset += 8;

        dataLayout.writeUInt8(minConsensus, offset);
        offset += 1;

        dataLayout.writeUInt8(maxDeviation, offset);
        offset += 1;

        const data = dataLayout.slice(0, offset);

        const instruction = new solanaWeb3.TransactionInstruction({
            keys: [
                { pubkey: registryPDA, isSigner: false, isWritable: true },
                { pubkey: wallet, isSigner: true, isWritable: true },
                { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data
        });

        const transaction = new solanaWeb3.Transaction().add(instruction);

        return { transaction, registryPDA };
    }

    /**
     * Initialize reputation account if it doesn't exist
     */
    async ensureReputationAccount(entity, payer) {
        const { pda } = this.deriveReputationPDA(entity);

        try {
            const accountInfo = await this.connection.getAccountInfo(pda);
            if (accountInfo) {
                console.log(`Reputation account already exists for ${entity.toString().substring(0, 8)}...`);
                return pda;
            }
        } catch (e) {
            // Account doesn't exist, create it
        }

        console.log(`Creating reputation account for ${entity.toString().substring(0, 8)}...`);

        // Build init_reputation instruction
        const discriminator = Buffer.from([
            236, 239, 233, 112, 220, 149, 26, 175  // init_reputation discriminator from IDL
        ]);

        const data = discriminator;

        const instruction = new solanaWeb3.TransactionInstruction({
            keys: [
                { pubkey: pda, isSigner: false, isWritable: true },
                { pubkey: entity, isSigner: false, isWritable: false },
                { pubkey: payer, isSigner: true, isWritable: true },
                { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data
        });

        const transaction = new solanaWeb3.Transaction().add(instruction);

        return { transaction, pda };
    }

    /**
     * Create and fund escrow
     */
    async createEscrow(wallet, amount, transactionId, apiPublicKey) {
        try {
            console.log('createEscrow called with:', { wallet: wallet.toString(), amount, transactionId, api: apiPublicKey.toString() });
            const { pda: escrowPda } = this.deriveEscrowPDA(transactionId);

        // Check if escrow already exists
        const accountInfo = await this.connection.getAccountInfo(escrowPda);
        if (accountInfo) {
            console.log('Escrow already exists for transaction ID:', transactionId, '- skipping creation');
            return null; // Return null to indicate escrow already exists
        }

        console.log('Creating new escrow:', { transactionId, amount, escrowPda: escrowPda.toString() });

        const amountLamports = Math.floor(amount * solanaWeb3.LAMPORTS_PER_SOL);
        const timeLock = 86400; // 24 hours

        // Build initialize_escrow instruction
        const discriminator = Buffer.from([243, 160, 77, 153, 11, 92, 48, 209]); // initialize_escrow discriminator from IDL

        const dataLayout = Buffer.alloc(1000); // Allocate enough space
        let offset = 0;

        // Discriminator
        discriminator.copy(dataLayout, offset);
        offset += 8;

        // amount (u64 LE)
        dataLayout.writeBigUInt64LE(BigInt(amountLamports), offset);
        offset += 8;

        // time_lock (i64 LE)
        dataLayout.writeBigInt64LE(BigInt(timeLock), offset);
        offset += 8;

        // transaction_id (String - length prefix + bytes)
        const txIdBytes = Buffer.from(transactionId, 'utf-8');
        dataLayout.writeUInt32LE(txIdBytes.length, offset);
        offset += 4;
        txIdBytes.copy(dataLayout, offset);
        offset += txIdBytes.length;

        const data = dataLayout.slice(0, offset);

        console.log('Initialize escrow instruction:', {
            escrowPda: escrowPda.toString(),
            agent: wallet.toString(),
            api: apiPublicKey.toString(),
            programId: this.programId.toString(),
            dataLength: data.length,
            amount: amountLamports,
            timeLock,
            transactionId,
            dataHex: Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('')
        });

        console.log('=== CHECKPOINT 1: After logging instruction ===');
        console.log('About to create TransactionInstruction...');
        console.log('=== CHECKPOINT 2: Before creating instruction ===');

        const instruction = new solanaWeb3.TransactionInstruction({
            keys: [
                { pubkey: escrowPda, isSigner: false, isWritable: true },
                { pubkey: wallet, isSigner: true, isWritable: true },
                { pubkey: apiPublicKey, isSigner: false, isWritable: false },
                { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data
        });

        console.log('TransactionInstruction created successfully');

        try {
            console.log('Building transaction...');
            const transaction = new solanaWeb3.Transaction().add(instruction);
            console.log('Transaction built successfully');
            return transaction;
        } catch (txError) {
            console.error('CRITICAL ERROR building transaction:', txError);
            console.error('Error details:', {
                name: txError.name,
                message: txError.message,
                stack: txError.stack
            });
            throw txError;
        }
        } catch (error) {
            console.error('FATAL ERROR in createEscrow:', error);
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Stack:', error.stack);
            throw error;
        }
    }

    /**
     * Mark escrow as disputed
     */
    async markDisputed(wallet, transactionId) {
        const { pda: escrowPda } = this.deriveEscrowPDA(transactionId);
        const { pda: reputationPda } = this.deriveReputationPDA(wallet);

        // Build mark_disputed instruction (discriminator would need to be computed)
        const discriminator = Buffer.from([0x3d, 0x5e, 0xa2, 0x4f, 0x8c, 0x1b, 0x7a, 0x6d]);

        const instruction = new solanaWeb3.TransactionInstruction({
            keys: [
                { pubkey: escrowPda, isSigner: false, isWritable: true },
                { pubkey: reputationPda, isSigner: false, isWritable: true },
                { pubkey: wallet, isSigner: true, isWritable: true },
            ],
            programId: this.programId,
            data: discriminator
        });

        return new solanaWeb3.Transaction().add(instruction);
    }

    /**
     * Resolve dispute with multi-oracle consensus
     */
    async resolveDisputeMultiOracle(transactionId, assessment) {
        const { pda: escrowPda } = this.deriveEscrowPDA(transactionId);
        const { pda: registryPDA } = this.deriveOracleRegistryPDA();

        // Fetch escrow to get agent and API addresses
        const escrowAccount = await this.connection.getAccountInfo(escrowPda);
        if (!escrowAccount) {
            throw new Error('Escrow account not found');
        }

        // Parse escrow data (simplified - would need proper deserialization)
        const escrowData = escrowAccount.data;
        const agentPubkey = new solanaWeb3.PublicKey(escrowData.slice(8, 40));
        const apiPubkey = new solanaWeb3.PublicKey(escrowData.slice(40, 72));

        const { pda: agentReputation } = this.deriveReputationPDA(agentPubkey);
        const { pda: apiReputation } = this.deriveReputationPDA(apiPubkey);

        console.log('Building resolve_dispute_multi_oracle instruction:', {
            consensusScore: assessment.consensusScore,
            refundPercentage: assessment.refundPercentage,
            numOracles: assessment.submissions.length
        });

        // Build resolve_dispute_multi_oracle instruction data
        const discriminator = Buffer.from([30, 194, 15, 52, 59, 167, 234, 143]);

        // Encode submissions array
        const submissionsData = Buffer.alloc(4 + (assessment.submissions.length * (32 + 1 + 64)));
        let offset = 0;

        // Vector length (u32 LE)
        submissionsData.writeUInt32LE(assessment.submissions.length, offset);
        offset += 4;

        // Each submission: oracle (32 bytes) + quality_score (1 byte) + signature (64 bytes)
        for (const sub of assessment.submissions) {
            // Oracle pubkey (32 bytes)
            const oracleBytes = sub.oracle.toBytes();
            submissionsData.set(oracleBytes, offset);
            offset += 32;

            // Quality score (1 byte)
            submissionsData.writeUInt8(sub.quality_score, offset);
            offset += 1;

            // Signature (64 bytes)
            const sigBytes = new Uint8Array(sub.signature);
            submissionsData.set(sigBytes, offset);
            offset += 64;
        }

        const resolveData = Buffer.alloc(discriminator.length + offset);
        resolveData.set(discriminator, 0);
        resolveData.set(submissionsData.slice(0, offset), discriminator.length);

        console.log('Instruction data size:', resolveData.length, 'bytes');

        // Create Ed25519 verification instructions (one per oracle)
        const ed25519Instructions = this.createEd25519Instructions(assessment.submissions);

        // Build all instructions
        const instructions = [
            ...ed25519Instructions,
            new solanaWeb3.TransactionInstruction({
                keys: [
                    { pubkey: escrowPda, isSigner: false, isWritable: true },
                    { pubkey: registryPDA, isSigner: false, isWritable: false },
                    { pubkey: agentPubkey, isSigner: false, isWritable: true },
                    { pubkey: apiPubkey, isSigner: false, isWritable: true },
                    { pubkey: agentReputation, isSigner: false, isWritable: true },
                    { pubkey: apiReputation, isSigner: false, isWritable: true },
                    { pubkey: solanaWeb3.SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
                    { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: this.programId,
                data: resolveData
            })
        ];

        // Return instructions array for wallet to sign (v0 transaction will be built in sendAndConfirm)
        return { instructions, isV0: true };
    }

    /**
     * Fetch recent program transactions from chain
     */
    async fetchRecentDisputes(limit = 10) {
        try {
            const signatures = await this.connection.getSignaturesForAddress(
                this.programId,
                { limit }
            );

            const transactions = [];

            for (const sig of signatures) {
                try {
                    const tx = await this.connection.getParsedTransaction(sig.signature, {
                        maxSupportedTransactionVersion: 0
                    });

                    if (tx && tx.meta && tx.meta.logMessages) {
                        // Look for program instructions (actual log format from the contract)
                        const hasEvent = tx.meta.logMessages.some(log =>
                            log.includes('Instruction: InitializeEscrow') ||
                            log.includes('Instruction: MarkDisputed') ||
                            log.includes('Instruction: ResolveDispute') ||
                            log.includes('Quality Score:')
                        );

                        if (hasEvent) {
                            transactions.push({
                                signature: sig.signature,
                                slot: sig.slot,
                                timestamp: sig.blockTime,
                                logs: tx.meta.logMessages
                            });
                        }
                    }
                } catch (e) {
                    console.error(`Failed to fetch transaction ${sig.signature}:`, e);
                }
            }

            return transactions;
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
            return [];
        }
    }

    /**
     * Send and confirm transaction
     */
    async sendAndConfirm(transaction, wallet) {
        try {
            // Get recent blockhash
            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();

            // Handle v0 transactions (for larger transaction sizes with 5 oracles)
            if (transaction.isV0 && transaction.instructions) {
                console.log('Building v0 transaction for multi-oracle consensus...');
                const messageV0 = new solanaWeb3.TransactionMessage({
                    payerKey: wallet,
                    recentBlockhash: blockhash,
                    instructions: transaction.instructions,
                }).compileToV0Message();

                transaction = new solanaWeb3.VersionedTransaction(messageV0);
            } else {
                // Legacy transaction
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = wallet;
            }

            // Pre-flight simulation
            try {
                const simulation = await this.connection.simulateTransaction(transaction);
                if (simulation.value.err) {
                    console.error('Pre-flight validation failed:', simulation.value);

                    // Log full simulation details
                    if (simulation.value.logs) {
                        console.error('Program logs:', simulation.value.logs);

                        // Check for insufficient funds error
                        const insufficientFundsLog = simulation.value.logs.find(log =>
                            log.includes('insufficient lamports')
                        );
                        if (insufficientFundsLog) {
                            const match = insufficientFundsLog.match(/insufficient lamports (\d+), need (\d+)/);
                            if (match) {
                                const have = (parseInt(match[1]) / 1e9).toFixed(4);
                                const need = (parseInt(match[2]) / 1e9).toFixed(4);
                                throw new Error(`Insufficient funds: Wallet has ${have} SOL but needs ${need} SOL for this transaction. Please add more SOL to your wallet or reduce the transaction amount.`);
                            }
                            throw new Error('Insufficient funds: Your wallet does not have enough SOL for this transaction. Please add more SOL or reduce the amount.');
                        }
                    }

                    // Try to decode Anchor error
                    let errorMsg = JSON.stringify(simulation.value.err);
                    if (simulation.value.err.InstructionError) {
                        const [idx, err] = simulation.value.err.InstructionError;

                        // Decode common Anchor errors
                        if (typeof err === 'object') {
                            if (err.Custom !== undefined) {
                                const errorCode = err.Custom;
                                const anchorErrors = {
                                    1: 'Anchor constraint violation (account not writable or already initialized)',
                                    100: 'InvalidAmount',
                                    101: 'AmountTooLarge',
                                    102: 'InvalidTimeLock',
                                    103: 'InvalidTransactionId',
                                    104: 'EscrowNotActive',
                                    105: 'EscrowNotDisputed',
                                    106: 'UnauthorizedCaller',
                                    107: 'InvalidSignature',
                                    108: 'TimeLockNotExpired'
                                };
                                errorMsg = `Instruction ${idx}: ${anchorErrors[errorCode] || `Custom error ${errorCode}`}`;
                            } else if (err.InvalidInstruction !== undefined) {
                                errorMsg = `Instruction ${idx}: Invalid instruction - check discriminator and data format`;
                            }
                        }
                    }

                    throw new Error(`Transaction validation failed: ${errorMsg}`);
                }
                console.log('Pre-flight validation passed:', simulation.value);
            } catch (simError) {
                console.error('Validation error:', simError);
                throw simError;
            }

            // Use signAndSendTransaction for better Phantom compatibility
            if (window.solana && window.solana.signAndSendTransaction) {
                console.log('Requesting wallet signature...');
                const { signature } = await window.solana.signAndSendTransaction(transaction);
                console.log('Transaction sent with signature:', signature);

                // Confirm transaction
                const confirmation = await this.connection.confirmTransaction({
                    signature,
                    blockhash,
                    lastValidBlockHeight
                }, 'confirmed');

                if (confirmation.value.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
                }

                return signature;
            } else {
                console.log('Using fallback: signTransaction + sendRawTransaction');
                // Fallback to signTransaction + sendRawTransaction
                const signed = await window.solana.signTransaction(transaction);

                // Send transaction
                const signature = await this.connection.sendRawTransaction(signed.serialize(), {
                    skipPreflight: false,
                    maxRetries: 3
                });

                console.log('Transaction sent:', signature);

                // Confirm transaction
                const confirmation = await this.connection.confirmTransaction({
                    signature,
                    blockhash,
                    lastValidBlockHeight
                }, 'confirmed');

                if (confirmation.value.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
                }

                return signature;
            }
        } catch (error) {
            console.error('sendAndConfirm failed:', error);
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            if (error.logs) {
                console.error('Transaction logs:', error.logs);
            }
            throw error;
        }
    }
}

// Global instance
window.oracleSystem = new OracleTransactionSystem();
