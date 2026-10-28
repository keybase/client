// Failures already seen on master, each with its cause. A listed failure still fails the release
// run (exit 1); the report only labels it, so a new failure stands out from the known ones. A
// listed entry that passes is reported so it gets removed: the gate is trusted once both lists
// are empty.
//   flows   `<file> › <describe…> › <title>` (file without .test.ts), or the title path alone
//   render  tour entry id
export const KNOWN_FAILURES: {flows: Record<string, string>; render: Record<string, string>} = {
  flows: {
    'chat-scroll › paging › scrolling up loads older pages without moving the reader, back to the first message':
      'rows re-measure from estimated height (17-20px drift, also without a page load) — real app behaviour on master; app fix tracked separately',
  },
  render: {},
}

export const KNOWN_FAILURES_FILE = 'tests/e2e/electron/known-failures.ts'

// `file` is the spec's file name without its directory and .test.ts; `titles` the describe titles
// and the test title.
export const flowTestKey = (file: string, titles: ReadonlyArray<string>) => [file, ...titles].join(' › ')

export const knownFlowCause = (
  file: string,
  titles: ReadonlyArray<string>,
  known: Record<string, string> = KNOWN_FAILURES.flows
): string | undefined => known[flowTestKey(file, titles)] ?? known[titles.join(' › ')]

export const knownRenderCause = (id: string, known: Record<string, string> = KNOWN_FAILURES.render) => known[id]

export type KnownVerdict = 'pass' | 'new failure' | 'known failure' | 'known now passes'

export const knownVerdict = (passed: boolean, cause: string | undefined): KnownVerdict =>
  passed ? (cause === undefined ? 'pass' : 'known now passes') : cause === undefined ? 'new failure' : 'known failure'

// The text the report and the summary show for a verdict, or undefined for a plain pass or failure.
export const knownNote = (verdict: KnownVerdict, cause: string | undefined) => {
  switch (verdict) {
    case 'known failure':
      return `known on master: ${cause ?? ''}`
    case 'known now passes':
      return `known failure now passes — remove it from ${KNOWN_FAILURES_FILE}`
    default:
      return undefined
  }
}
