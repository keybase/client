// Pure helpers of errors.ts and finish.ts, kept apart so jest can test them without wdio.

// Marks an error captured from the app's global handler, which fails the attempt (a console.error does not).
export const UNCAUGHT_PREFIX = 'uncaught: '

export const uncaughtErrors = (errors: Array<string>) => errors.filter(e => e.startsWith(UNCAUGHT_PREFIX))

// The last `n` lines of text that may begin mid-line (a tail read of a file).
export const tailLines = (text: string, n: number) => text.split('\n').filter(Boolean).slice(-n).join('\n')
