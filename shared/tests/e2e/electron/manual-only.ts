// What the automated release run cannot or must not do: each needs a human, a real external
// service, or the OS shell. The report lists them as a checklist after every run.
export const MANUAL_ONLY = {
  'signup-submit': {
    doByHand: 'Walk the signup flow with a throwaway account and press the final submit. Accounts are never created by automation.',
    title: 'Signup final submit',
  },
  'delete-account-confirm': {
    doByHand: 'Open Settings > Account > Delete account, read the confirm screen, and confirm on a throwaway account only.',
    title: 'Delete account final confirm',
  },
  'sms-code': {
    doByHand: 'Add a phone number you own and enter the SMS code that arrives.',
    title: 'SMS verification code',
  },
  'email-link': {
    doByHand: 'Add an email you own, click the verification link, and send an invite to a non-test address.',
    title: 'Email verification link and invite to a non-test address',
  },
  'external-proofs': {
    doByHand: 'Prove an identity on an external site (Twitter, GitHub, DNS, ...) and check it shows verified on the profile.',
    title: 'Proofs on external sites',
  },
  'block-report-submit': {
    doByHand: 'Open the block modal, check the report option, and submit against a throwaway account.',
    title: 'Block-and-report submit',
  },
  'feedback-send': {
    doByHand: 'Settings > Feedback: write a note and press Send.',
    title: 'Settings > Feedback send',
  },
  'os-notification': {
    doByHand: 'Receive a message while the window is in the background: the macOS notification toast appears and clicking it opens that conversation.',
    title: 'macOS notification toast and click-through',
  },
  'os-tray-badge': {
    doByHand: 'Menu-bar tray icon shows the right state and unread badge.',
    title: 'Tray icon and badge',
  },
  'os-dock-badge': {
    doByHand: 'Dock icon badge count matches the unread count.',
    title: 'Dock badge',
  },
  'os-open-in-finder': {
    doByHand: 'Files > a file or folder > Show in Finder opens Finder at the right place.',
    title: 'Open in Finder',
  },
  'os-drag-to-finder': {
    doByHand: 'Drag a file out of the app into a Finder window; the file lands there.',
    title: 'Drag a file to Finder',
  },
  'os-file-pickers': {
    doByHand: 'Every system file picker (attach, upload, save as, avatar) opens, selects, and returns the file.',
    title: 'System file pickers',
  },
  'os-fuse-mount': {
    doByHand: 'The Keybase volume is mounted and browsable in Finder.',
    title: 'FUSE mount visible in Finder',
  },
  'auto-update-installer': {
    doByHand: 'Install the release build from the installer and check the auto-update prompt and relaunch.',
    title: 'Auto-update and installer',
  },
  'quit-app': {
    doByHand: "Tab bar menu > Quit, and the menubar's Quit: the app and service stop; relaunch.",
    title: 'Quit Keybase',
  },
} satisfies Record<string, {title: string; doByHand: string}>

export type ManualOnlyId = keyof typeof MANUAL_ONLY
