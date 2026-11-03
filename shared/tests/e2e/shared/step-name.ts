// Step attachment names, `step-NN-<slug>`: written by both gates' step helpers, read by the report.

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// NN counts from 01 within the test
export const stepAttachmentName = (n: number, name: string) => `step-${String(n).padStart(2, '0')}-${slug(name)}`

export function parseStepName(name: string): {n: number; slug: string} | null {
  const m = /^step-(\d+)-(.+)$/.exec(name)
  return m ? {n: Number(m[1]), slug: m[2]!} : null
}
