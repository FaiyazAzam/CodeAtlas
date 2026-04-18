import type { AnalysisResult } from "@/types/analysis";

export function exportAnalysisMarkdown(analysis: AnalysisResult): string {
  const topFiles = analysis.onboarding.topFiles
    .map((file, index) => `${index + 1}. \`${file.path}\` - ${file.reason}`)
    .join("\n");

  const modules = analysis.graph.nodes
    .map((node) => `- **${node.label}** (${node.confidence}): ${node.summary}`)
    .join("\n");

  const flow = analysis.onboarding.probableFlow.map((step) => `- ${step}`).join("\n");
  const questions = analysis.onboarding.questions.map((question) => `- ${question}`).join("\n");

  return `# CodeAtlas Summary: ${analysis.repo.owner}/${analysis.repo.name}

${analysis.onboarding.whatItDoes}

## Stack
${analysis.stack.map((badge) => `- ${badge.label} (${badge.confidence})`).join("\n")}

## Major Modules
${modules}

## Start Here
${topFiles}

## Probable Flow
${flow}

## Open Questions
${questions}
`;
}
