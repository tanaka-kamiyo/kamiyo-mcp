import { Connection, PublicKey, Keypair, TransactionSignature } from '@solana/web3.js';

export class SolanaClient {
  private connection: Connection;
  private keypair: Keypair;

  constructor(rpcUrl: string, keypair: Keypair) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.keypair = keypair;
  }

  getConnection(): Connection {
    return this.connection;
  }

  getKeypair(): Keypair {
    return this.keypair;
  }

  getPublicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  async getBalance(): Promise<number> {
    return await this.connection.getBalance(this.keypair.publicKey);
  }

  async confirmTransaction(signature: TransactionSignature): Promise<void> {
    const latestBlockhash = await this.connection.getLatestBlockhash();
    await this.connection.confirmTransaction({
      signature,
      ...latestBlockhash,
    });
  }

  async airdrop(lamports: number): Promise<TransactionSignature> {
    const signature = await this.connection.requestAirdrop(
      this.keypair.publicKey,
      lamports
    );
    await this.confirmTransaction(signature);
    return signature;
  }
}
