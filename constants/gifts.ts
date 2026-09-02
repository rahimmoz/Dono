// Single source of truth for gift tiers -- DonateModal (the picker) and
// DonationAnimation (the payoff) both read from this, so adding a new tier
// or changing a price only ever needs to happen in one place.

export type AnimationType = 'spark' | 'ripple' | 'rain' | 'fireworks' | 'shake' | 'supernova';

export type GiftTier = {
  amount: number;
  name: string;
  icon: string;
  color: string;
  glow: string;
  animation: AnimationType;
};

export const GIFT_TIERS: GiftTier[] = [
  { amount: 1, name: 'Spark', icon: '✨', color: '#00FF00', glow: 'rgba(0, 255, 0, 0.25)', animation: 'spark' },
  { amount: 5, name: 'Ripple', icon: '💧', color: '#00f2ea', glow: 'rgba(0, 242, 234, 0.3)', animation: 'ripple' },
  { amount: 10, name: 'Golden Rain', icon: '🌟', color: '#FFD700', glow: 'rgba(255, 215, 0, 0.35)', animation: 'rain' },
  { amount: 25, name: 'Fireworks', icon: '🎆', color: '#FF8C00', glow: 'rgba(255, 140, 0, 0.4)', animation: 'fireworks' },
  { amount: 50, name: 'Whale Drop', icon: '🐋', color: '#FF00FF', glow: 'rgba(255, 0, 255, 0.5)', animation: 'shake' },
  { amount: 100, name: 'Supernova', icon: '💥', color: '#FF0055', glow: 'rgba(255, 0, 85, 0.55)', animation: 'supernova' },
];

// Highest tier whose threshold the amount meets or exceeds.
export function getTierForAmount(amount: number): GiftTier {
  let matched = GIFT_TIERS[0];
  for (const tier of GIFT_TIERS) {
    if (amount >= tier.amount) matched = tier;
  }
  return matched;
}
