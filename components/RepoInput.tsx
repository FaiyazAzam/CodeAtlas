"use client";

import { FormEvent, useState } from "react";

type SampleRepo = {
  label: string;
  url: string;
  description: string;
};

type RepoInputProps = {
  samples: SampleRepo[];
  isLoading: boolean;
  onAnalyze: (repoUrl: string) => void;
};

export function RepoInput({ samples, isLoading, onAnalyze }: RepoInputProps) {
  const [repoUrl, setRepoUrl] = useState(samples[0]?.url ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAnalyze(repoUrl);
  }

  return (
    <div>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
        <label className="sr-only" htmlFor="repo-url">
          GitHub repository URL
        </label>
        <input
          id="repo-url"
          className="focus-ring min-h-12 flex-1 rounded-md border border-line bg-ink px-4 text-sm text-paper placeholder:text-paper/35"
          value={repoUrl}
          onChange={(event) => setRepoUrl(event.target.value)}
          placeholder="https://github.com/vercel/next.js"
        />
        <button
          className="focus-ring min-h-12 rounded-md bg-mint px-5 text-sm font-semibold text-ink transition hover:bg-[#65e8b4] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? "Analyzing..." : "Analyze Repo"}
        </button>
      </form>

      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        {samples.map((sample) => (
          <button
            key={sample.url}
            className="focus-ring rounded-md border border-line bg-paper/[0.04] p-3 text-left transition hover:border-mint/50 hover:bg-mint/10"
            onClick={() => {
              setRepoUrl(sample.url);
              onAnalyze(sample.url);
            }}
            type="button"
          >
            <span className="text-sm font-semibold text-paper">{sample.label}</span>
            <span className="mt-1 block text-xs leading-5 text-paper/55">{sample.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
