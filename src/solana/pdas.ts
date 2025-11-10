import { PublicKey } from '@solana/web3.js';

export class PDAUtil {
  private programId: PublicKey;

  constructor(programId: PublicKey) {
    this.programId = programId;
  }

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

  deriveRateLimiterPDA(entity: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('rate_limit'), entity.toBuffer()],
      this.programId
    );
  }
}
