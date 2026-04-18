import type { Confidence } from "@/types/analysis";

const toneByConfidence: Record<Confidence, string> = {
  high: "border-mint/50 bg-mint/10 text-mint",
  medium: "border-gold/50 bg-gold/10 text-gold",
  low: "border-coral/50 bg-coral/10 text-coral"
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${toneByConfidence[confidence]}`}>
      {confidence}
    </span>
  );
}
