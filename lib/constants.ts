export const SAMPLE_REPOS = [
  {
    label: "Next.js Commerce",
    url: "https://github.com/vercel/commerce",
    description: "Modern storefront structure with app routes, UI, and provider integrations."
  },
  {
    label: "Supabase",
    url: "https://github.com/supabase/supabase",
    description: "Large platform repo with services, docs, packages, and tooling."
  },
  {
    label: "Cal.com",
    url: "https://github.com/calcom/cal.com",
    description: "Production scheduling app with web, API, packages, and integrations."
  }
];

export const IGNORED_SEGMENTS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "out",
  "coverage",
  ".cache",
  "tmp",
  "temp",
  "__pycache__"
]);

export const IGNORED_FILENAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "composer.lock",
  "poetry.lock",
  "cargo.lock",
  ".DS_Store"
]);

export const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".mp4",
  ".mov",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot"
]);
