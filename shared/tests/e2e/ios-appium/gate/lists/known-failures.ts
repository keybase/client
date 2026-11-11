import type {KnownList} from '../../../shared/gate/known.ts'

// Failures already seen on master, each with its cause. A listed failure still fails the release
// run (exit 1); the report only labels it, so a new failure stands out from the known ones. A
// listed entry that passes is reported so it gets removed: the gate is trusted once both lists
// are empty.
//   flows   `<file> › <describe…> › <title>` (file without .test.ts), or the title path alone
//   render  tour entry id
export const IOS_KNOWN_FAILURES: KnownList = {
  flows: {
    // confirmed live (PR 5, three gate runs): the offset climbs with each landing row to 125 and the
    // newest row ends 114pt below the composer
    'chat-scroll › chat scroll › a burst of incoming messages › at the end, a burst of incoming messages keeps the thread at its end':
      'the thread list stops following new rows when each lands during the animated follow of the one before (maintainVisibleContentPosition autoscroll), leaving it short of its end; predates the newer scroll fixes, suspected on master',
    // confirmed live (PR 5, two gate runs): the centred hit's row moves from 427.7 to 404.3 and stays
    'chat-scroll › chat scroll › closing search › closing search leaves the list where it is':
      'closing thread search swaps the search bar back for the composer and the scroll view keeps its offset, so the rows shift with the layout change and nothing puts them back (exact cause not pinned down); suspected on master',
    // intermittent (PR 5, 1 of 6 gate runs, full run 9d3gl8): after the drag back to the end, one
    // incoming message's row landed and the offset followed 31.7pt, leaving the newest row's bottom
    // 20.7pt below the viewport (758.7 vs 738); it passes on the other runs
    'chat-scroll › chat scroll › back to the end › dragging back down re-pins it, and a later incoming message keeps the end':
      "the thread list's follow of a new row at the end can stop short of the row's full height (the burst entry's maintainVisibleContentPosition autoscroll, here with one row after a drag re-pinned the end); intermittent, suspected on master",
    // PR 7 live (both release-only runs, 12:16 and 13:00): the peer's decrypt adds per-user keys 1..19
    // while the phone encrypted to 21 ("no suitable key found"); a restart of the peer does not help.
    // In a full run it can pass: the chat flows before it send from the second peer, which syncs its
    // keyring (the workaround below), so a "known failure passed" there is expected; it fails again
    // in a run without them, so keep the entry until the Go fix lands
    "crypto-roundtrip › crypto roundtrip › text encrypted to the second account decrypts on its peer":
      "the second peer's SaltpackDecrypt uses its per-user-key keyring without syncing it; after the account's key rolls on another device (the password flow), it cannot decrypt to the newest key (Go follow-up). Owner workaround: any chat send from the second peer syncs the keyring",
    // PR 8 live B (two driven repros, and run 6's simulator log): the relaunched process never starts
    // the native watcher; the restored tracker asks for the watch about 1s before the app registers
    // its chat UI
    'chat-location › chat location › with the app killed while sharing, the relaunched app restores the share and posts a move once it is in front':
      "the service restores the share at startup (go/service/main.go LiveLocationTracker.Start) before the app has registered its chat UI; getChatUI then hands back NullChatUI, whose ChatWatchPosition answers watch 0 with no error, so startWatch's retry for a UI that isn't ready never runs (go/chat/maps/livelocation.go), the app is never asked to watch, and the tracker waits for a fix that never comes; the same on master (PR 9)",
  },
  render: {},
}

export const IOS_KNOWN_FAILURES_FILE = 'tests/e2e/ios-appium/gate/lists/known-failures.ts'
