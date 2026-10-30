// Pure helpers of step.ts and errors.ts, kept apart so jest can test them without wdio.

const kebab = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// The report reads steps by this shape (step-NN-<slug>), as the desktop's do.
export const stepAttachmentName = (index: number, name: string) => `step-${String(index).padStart(2, '0')}-${kebab(name)}`

// Marks an error captured from the app's global handler, which fails the attempt (a console.error does not).
export const UNCAUGHT_PREFIX = 'uncaught: '

export const uncaughtErrors = (errors: Array<string>) => errors.filter(e => e.startsWith(UNCAUGHT_PREFIX))

// The last `n` lines of text that may begin mid-line (a tail read of a file).
export const tailLines = (text: string, n: number) => text.split('\n').filter(Boolean).slice(-n).join('\n')
