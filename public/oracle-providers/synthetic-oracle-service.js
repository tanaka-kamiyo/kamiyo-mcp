/**
 * Synthetic Multi-Oracle Service for Hackathon Demo
 *
 * Creates realistic oracle assessments based on one real assessment (Kamiyo)
 * with controlled variance to demonstrate multi-oracle consensus
 */

const nacl = require('tweetnacl');
const fs = require('fs');
const path = require('path');

class SyntheticOracleService {
    constructor() {
        // Load all oracle keypairs
        this.oracles = this.loadOracles();
        console.log('🔮 Synthetic Oracle Service Initialized');
        console.log('   Oracles loaded:', Object.keys(this.oracles).length);
    }

    loadOracles() {
        const oracleIds = ['kamiyo', 'auditor', 'community', 'ai-service', 'academic'];
        const oracles = {};

        for (const id of oracleIds) {
            try {
                const keypairPath = path.join(__dirname, `${id}-keypair.json`);
                const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
                oracles[id] = {
                    id,
                    publicKey: keypairData.publicKey,
                    secretKey: new Uint8Array(keypairData.secretKey)
                };
            } catch (err) {
                console.warn(`   Warning: Could not load ${id} keypair`);
            }
        }

        return oracles;
    }

    /**
     * Generate synthetic oracle assessments based on base score
     * @param {string} transactionId - Transaction ID
     * @param {number} baseScore - Base quality score (from real Kamiyo AI assessment)
     * @param {object} apiData - API response data
     * @returns {Array} Array of oracle assessments
     */
    generateAssessments(transactionId, baseScore, apiData) {
        const assessments = [];

        // Oracle 1: Kamiyo AI (Real Assessment)
        assessments.push({
            oracle: 'kamiyo',
            name: 'Kamiyo AI',
            score: baseScore, // Use actual AI assessment
            methodology: 'Claude/GPT-4 AI analysis',
            ...this.signScore(transactionId, baseScore, this.oracles.kamiyo.secretKey)
        });

        // Oracle 2: QualityMetrics Inc (Conservative - scores 2-5 points lower)
        const auditorScore = Math.max(0, Math.min(100, baseScore - this.random(2, 5)));
        assessments.push({
            oracle: 'auditor',
            name: 'QualityMetrics Inc',
            score: auditorScore,
            methodology: 'Human expert review (tends conservative)',
            ...this.signScore(transactionId, auditorScore, this.oracles.auditor.secretKey)
        });

        // Oracle 3: Community DAO (Optimistic - scores 1-4 points higher)
        const communityScore = Math.max(0, Math.min(100, baseScore + this.random(1, 4)));
        assessments.push({
            oracle: 'community',
            name: 'DataVerify DAO',
            score: communityScore,
            methodology: 'Community voting (tends optimistic)',
            ...this.signScore(transactionId, communityScore, this.oracles.community.secretKey)
        });

        // Oracle 4: DataQuality.ai (Similar AI - variance -2 to +2)
        const aiServiceScore = Math.max(0, Math.min(100, baseScore + this.random(-2, 2)));
        assessments.push({
            oracle: 'ai-service',
            name: 'DataQuality.ai',
            score: aiServiceScore,
            methodology: 'Alternative AI model (GPT-4)',
            ...this.signScore(transactionId, aiServiceScore, this.oracles['ai-service'].secretKey)
        });

        // Oracle 5: Academic Lab (Research-based - slight variance -1 to +3)
        const academicScore = Math.max(0, Math.min(100, baseScore + this.random(-1, 3)));
        assessments.push({
            oracle: 'academic',
            name: 'University Research Lab',
            score: academicScore,
            methodology: 'Peer-reviewed metrics',
            ...this.signScore(transactionId, academicScore, this.oracles.academic.secretKey)
        });

        return assessments;
    }

    /**
     * Sign a quality score with oracle keypair
     */
    signScore(transactionId, score, secretKey) {
        const message = `${transactionId}:${score}`;
        const messageBytes = new TextEncoder().encode(message);
        const signature = nacl.sign.detached(messageBytes, secretKey);

        return {
            signature: Array.from(signature),
            message,
            signatureBase64: Buffer.from(signature).toString('base64')
        };
    }

    /**
     * Random integer between min and max (inclusive)
     */
    random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Calculate consensus from assessments (mimics on-chain logic)
     */
    calculateConsensus(assessments, maxDeviation = 15) {
        const scores = assessments.map(a => a.score).sort((a, b) => a - b);
        const median = scores[Math.floor(scores.length / 2)];

        const min = scores[0];
        const max = scores[scores.length - 1];
        const deviation = max - min;
        const deviationPercent = (deviation / median) * 100;

        const consensusReached = deviationPercent <= maxDeviation;

        return {
            scores,
            median,
            min,
            max,
            deviation,
            deviationPercent: deviationPercent.toFixed(1),
            consensusReached,
            refundPercentage: this.calculateRefund(median)
        };
    }

    /**
     * Calculate refund percentage from quality score
     */
    calculateRefund(qualityScore) {
        if (qualityScore < 50) return 100;
        if (qualityScore < 65) return 75;
        if (qualityScore < 80) return 35;
        return 0;
    }

    /**
     * Demo: Show complete multi-oracle assessment
     */
    demo(transactionId = 'demo-tx-001', baseScore = 85, apiData = {}) {
        console.log('\n🎭 SYNTHETIC MULTI-ORACLE DEMO\n');
        console.log('Transaction ID:', transactionId);
        console.log('Base Score (Kamiyo AI Real Assessment):', baseScore);
        console.log('\n' + '='.repeat(70) + '\n');

        // Generate all assessments
        const assessments = this.generateAssessments(transactionId, baseScore, apiData);

        // Display each oracle's assessment
        console.log('📊 INDIVIDUAL ORACLE ASSESSMENTS:\n');
        assessments.forEach((a, i) => {
            console.log(`Oracle ${i + 1}: ${a.name}`);
            console.log(`  Score: ${a.score}`);
            console.log(`  Methodology: ${a.methodology}`);
            console.log(`  Signature: ${a.signatureBase64.slice(0, 32)}...`);
            console.log('');
        });

        // Calculate consensus
        const consensus = this.calculateConsensus(assessments);

        console.log('='.repeat(70) + '\n');
        console.log('⚖️  ON-CHAIN CONSENSUS CALCULATION:\n');
        console.log('  Scores (sorted):', consensus.scores.join(', '));
        console.log('  Median:', consensus.median);
        console.log('  Range:', `${consensus.min} - ${consensus.max}`);
        console.log('  Deviation:', `${consensus.deviation} points (${consensus.deviationPercent}%)`);
        console.log('  Max Allowed:', '15%');
        console.log('  Consensus:', consensus.consensusReached ? '✅ REACHED' : '❌ FAILED');
        console.log('\n' + '='.repeat(70) + '\n');

        // Show result
        console.log('💰 DISPUTE RESOLUTION RESULT:\n');
        console.log('  Quality Score:', consensus.median);
        console.log('  Quality Tier:', this.getQualityTier(consensus.median));
        console.log('  Refund to Agent:', `${consensus.refundPercentage}%`);
        console.log('  Payment to API Provider:', `${100 - consensus.refundPercentage}%`);
        console.log('\n' + '='.repeat(70) + '\n');

        return {
            assessments,
            consensus,
            transactionId
        };
    }

    getQualityTier(score) {
        if (score >= 80) return 'Excellent (80-100)';
        if (score >= 65) return 'Good (65-79)';
        if (score >= 50) return 'Fair (50-64)';
        return 'Poor (<50)';
    }

    /**
     * Get formatted data for on-chain submission
     */
    formatForOnChain(assessments) {
        return assessments.map(a => ({
            oracle: a.publicKey || this.oracles[a.oracle].publicKey,
            qualityScore: a.score,
            signature: a.signature
        }));
    }
}

// CLI Demo
if (require.main === module) {
    const service = new SyntheticOracleService();

    // Demo with different base scores
    console.log('🎬 DEMO 1: Excellent Quality (Base Score: 87)');
    service.demo('tx-001', 87);

    console.log('\n\n🎬 DEMO 2: Good Quality (Base Score: 72)');
    service.demo('tx-002', 72);

    console.log('\n\n🎬 DEMO 3: Fair Quality (Base Score: 55)');
    service.demo('tx-003', 55);

    console.log('\n\n🎬 DEMO 4: Poor Quality (Base Score: 42)');
    service.demo('tx-004', 42);
}

module.exports = SyntheticOracleService;
