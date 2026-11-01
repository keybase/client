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
    // confirmed live (PR 6, three runs): the default channels' popup opens to 90% of the screen and
    // its search reads "Search 1 channel", but no channel row is drawn, so there is nothing to pick
    "teams-settings › teams settings › a channel added to a subteam's default channels from the popup, and removed from its pill":
      "the phone's default-channels popup (teams/team/settings-tab/channel-popup.tsx) draws its channel list empty though it holds the channel (its count shows in the search placeholder); the list sits in a Kb.BoxGrow inside the sheet, likely laid out at no height; the file is the same on master (PR 9)",
    // PR 7 live (both release-only runs, 12:16 and 13:00): the peer's decrypt adds per-user keys 1..19
    // while the phone encrypted to 21 ("no suitable key found"); a restart of the peer does not help
    "crypto-roundtrip › crypto roundtrip › text encrypted to the second account decrypts on its peer":
      "the second peer's SaltpackDecrypt uses its per-user-key keyring without syncing it; after the account's key rolls on another device (the password flow), it cannot decrypt to the newest key (Go follow-up). Owner workaround: any chat send from the second peer syncs the keyring",
    // PR 7 live (two runs, 08:11 and 08:40): the host's main service hung in a logout hook on the
    // switch to the second account right after the phone's change; the flow no longer switches it
    "settings-password › settings password › the second account password changed from the phone, then signed in with":
      "the host's stored secret for the second account is not checked: right after this change, the host's login switch deadlocks in a logout hook (Go follow-up). The owner runs yarn test:e2e:accounts:second-password --check after the release",
  },
  render: {},
}

export const IOS_KNOWN_FAILURES_FILE = 'tests/e2e/ios-appium/gate/lists/known-failures.ts'
