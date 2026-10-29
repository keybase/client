export type KnownList = {flows: Record<string, string>; render: Record<string, string>}

// `file` is the spec's file name without its directory and .test.ts; `titles` the describe titles
// and the test title.
export const flowTestKey = (file: string, titles: ReadonlyArray<string>) => [file, ...titles].join(' › ')

export const knownFlowCause = (
  file: string,
  titles: ReadonlyArray<string>,
  known: Record<string, string>
): string | undefined => known[flowTestKey(file, titles)] ?? known[titles.join(' › ')]

export const knownRenderCause = (id: string, known: Record<string, string>) => known[id]

export type KnownVerdict = 'pass' | 'new failure' | 'known failure' | 'known now passes'

export const knownVerdict = (passed: boolean, cause: string | undefined): KnownVerdict =>
  passed ? (cause === undefined ? 'pass' : 'known now passes') : cause === undefined ? 'new failure' : 'known failure'

// The text the report and the summary show for a verdict, or undefined for a plain pass or failure.
export const knownNote = (verdict: KnownVerdict, cause: string | undefined, listFile: string) => {
  switch (verdict) {
    case 'known failure':
      return `known on master: ${cause ?? ''}`
    case 'known now passes':
      return `known failure now passes — remove it from ${listFile}`
    default:
      return undefined
  }
}
