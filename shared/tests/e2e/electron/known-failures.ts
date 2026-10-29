// Failures already seen on master, each with its cause. A listed failure still fails the release
// run (exit 1); the report only labels it, so a new failure stands out from the known ones. A
// listed entry that passes is reported so it gets removed: the gate is trusted once both lists
// are empty.
//   flows   `<file> › <describe…> › <title>` (file without .test.ts), or the title path alone
//   render  tour entry id
export const KNOWN_FAILURES: {flows: Record<string, string>; render: Record<string, string>} = {
  flows: {
    'app-windows › menubar recent files list a file written since the last show':
      "the widget loads its recent files once per main-window session: useMenubarTlfUpdates (menubar/remote-proxy.desktop.tsx) loads when windowShownCount('menu') first passes 0 and never again, where before #29122 the widget reloaded them on every show — real app behaviour on master",
    'chat-scroll › paging › scrolling up loads older pages without moving the reader, back to the first message':
      'rows re-measure from estimated height (17-20px drift, also without a page load) — real app behaviour on master; app fix tracked separately',
    'crypto-roundtrip › text encrypted for someone else says so':
      'the service names the cause of a decrypt failure in the error\'s Code field as a string (go/libkb/rpc_exim.go DecryptionError.ToStatus: strconv.Itoa), and getStatusCodeMessage (crypto/helpers.tsx) looks it up among numeric status codes, so no cause ever matches and every decrypt failure shows "Failed to decrypt text." — real app behaviour on master',
    'people-follow-hover › the Following button reads Unfollow on hover':
      "the follow button's hover label is set from onMouseEnter on a Kb.Box2, and the desktop Box2 (common-adapters/box.tsx) does not pass onMouseEnter to its div, so \"Following\" never reads \"Unfollow\" — real app behaviour on master",
    'profile-avatar › set the avatar':
      'an untouched crop is saved as NaN (profile/edit-avatar: the crop is set only by pointer moves on the image); the service cannot decode uploadUserAvatar, drops the connection, and the modal shows "This image format is not supported" — real app behaviour on master',
    'settings-archive › backup all files':
      'the modal\'s "Started N jobs" counts a job for every favorite folder, but SimpleFSArchiveStart (go/kbfs/simplefs/simplefs.go ~3843) returns an empty job description with no error for a favorite that has no folder branch yet, and SimpleFSArchiveAllFiles counts it as started, so far fewer jobs exist than reported — real service behaviour on master',
    'teams-settings › avatar':
      'an untouched crop is saved as NaN (profile/edit-avatar: the crop is set only by pointer moves on the image); the service cannot decode it and the modal shows "This image format is not supported" — real app behaviour on master',
    'teams-settings › showcase box shows the setting and turns it off':
      "the settings box reads the team's own publicity, not the member's showcase (teams/team/use-loaded-team.tsx showcasing: annotatedTeam.showcase.isShowcased), so unchecking it is compared against that flag and sends nothing; reopened, the box shows unchecked while the subteam stays featured — real app behaviour on master",
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
