import type {KnownList} from '../shared/gate/known.ts'

// Failures already seen on master, each with its cause. A listed failure still fails the release
// run (exit 1); the report only labels it, so a new failure stands out from the known ones. A
// listed entry that passes is reported so it gets removed: the gate is trusted once both lists
// are empty.
//   flows   `<file> › <describe…> › <title>` (file without .test.ts), or the title path alone
//   render  tour entry id
export const KNOWN_FAILURES: KnownList = {
  flows: {
    'chat-scroll › paging › scrolling up loads older pages without moving the reader, back to the first message':
      'rows re-measure from estimated height (17-20px drift, also without a page load) — real app behaviour on master; app fix tracked separately',
  },
  render: {},
}

export const KNOWN_FAILURES_FILE = 'tests/e2e/electron/known-failures.ts'
