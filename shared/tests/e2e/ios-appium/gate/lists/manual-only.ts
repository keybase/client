// What the automated iOS release run cannot or must not do: each needs a human, a real external
// service, or the OS. The report lists them as a checklist after every run.
export const IOS_MANUAL_ONLY = {
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
  'camera-capture': {
    doByHand: 'On a device: scan a QR code in the provisioning scanner, and take a photo and a video from the chat attach menu; each returns to the app with the capture.',
    title: 'Camera: QR scan and photo or video capture',
  },
  'apns-delivery': {
    doByHand: 'On a device: receive a message while the app is in the background; the real push arrives, and tapping it opens that conversation.',
    title: 'Real push delivery from the server',
  },
  'os-permission-prompts': {
    doByHand:
      "On a fresh install: the notification and camera permission prompts appear when the app first needs them, and allowing each works. The simulator's push permission is granted once by hand (simctl privacy has no notification service, and iOS asks once per install), so the gate never sees the notification prompt.",
    title: 'OS permission prompts the simulator cannot pre-grant',
  },
  'share-sheet-out': {
    doByHand: 'Share a message, a file and a link from Keybase into another app through the system share sheet; each arrives.',
    title: 'System share sheet into other apps',
  },
  'app-store-testflight': {
    doByHand: 'Install the release build from TestFlight or the App Store and update over the previous version; the app launches signed in.',
    title: 'App Store and TestFlight install and update',
  },
  'provision-qr-camera': {
    doByHand:
      'On a device: run `keybase login` on a new computer and pick the phone, then on the phone Settings > Devices > Add a device or paper key > Add a computer and scan the QR code the computer shows; the computer lands signed in.',
    title: 'Camera: approving a new computer by scanning its QR code',
  },
  'delete-through-reloads': {
    doByHand:
      'In a chat, turn the network off, delete one of your own messages for everyone, pull the thread to reload it: the row stays and shows deleting. Turn the network back on: the row goes.',
    title: 'A chat delete waiting on the network keeps its row through reloads',
  },
  'failed-send-cancel': {
    doByHand:
      "In a chat, paste a message over 10,000 characters and send it: it fails as too long with \"Edit or Cancel\" under it. Tap Cancel: the message goes and does not come back after reopening the conversation.",
    title: "Tapping a failed message's inline Cancel",
  },
  'giphy-pick': {
    doByHand:
      "In a throwaway chat channel, tap + then Share a GIF, type a search after /giphy, and tap a GIF in the picker: it posts to the channel and the picker closes. Delete the channel after.",
    title: 'Picking a GIF in the phone GIF picker',
  },
  'hardware-keyboard-enter': {
    doByHand:
      'On an iPad or a phone with a hardware keyboard: in a chat composer, type two words with Shift-Enter between them (a new line), then press Enter; the message sends with both lines.',
    title: 'Hardware keyboard Shift-Enter and Enter in a chat composer',
  },
  'backup-all': {
    doByHand:
      'On a throwaway account whose folders and repos are all its own: Settings > Backup > "Backup all files", then "Backup all Git repos"; every job listed runs to the end, and Share hands off its zip. Remove the jobs after.',
    title: 'Backup all files and all Git repos',
  },
  'second-password-host-check': {
    doByHand:
      "After the release: run yarn test:e2e:accounts:second-password --check. It settles a password change left pending and checks that the host's main service still switches to the second account with its stored secret, which the iOS password flow does not do.",
    title: "The host's stored secret for the second account, after the phone changed its password",
  },
  'location-os-relaunch': {
    doByHand:
      'On a device: share live location from a chat, swipe the app away, move far enough for a significant change, and check iOS relaunches it and a move is posted without opening it. The simulator cannot: simctl terminate is a force-quit, and iOS never relaunches a force-quit app for location (live: no relaunch within 5 minutes of a far move).',
    title: 'iOS relaunching a killed app for live location',
  },
  'phone-new-device': {
    doByHand: 'On a fresh install, add this phone as a new device from an existing device (scan or type the code), then check it lands signed in.',
    title: 'Phone as a new device',
  },
  'files-upload-failed-dismiss': {
    doByHand:
      'In a throwaway folder of Files on the phone, upload a file with the phone offline (or into a folder that refuses the write) so its row shows "Upload has failed.", tap Dismiss, and check the row and the error go. A successful phone upload never sends the dismiss: its card hides itself.',
    title: "A failed upload's Dismiss in Files",
  },
  'offline-reconnect': {
    doByHand:
      "On a device: turn on Airplane Mode with a chat open, check the thread shows \"Couldn't load all chat messages due to network connectivity. Retrying...\" once it reloads, send a message (it waits as pending), then turn Airplane Mode off: the app reconnects, the banner goes and the message sends. The simulator shares the Mac's network, so the gate never cuts it.",
    title: 'Losing the network and reconnecting',
  },
  'audio-message': {
    doByHand:
      'On a device: in a throwaway chat, hold the composer\'s microphone button, speak, release, and check the audio message posts and plays back; then hold, slide to cancel, and check nothing posts. On a simulator the button records the Mac\'s microphone, so the gate never presses it.',
    title: 'Recording and sending an audio message',
  },
  'share-extension-sources': {
    doByHand:
      'On a device, share each into Keybase\'s own self conversation through the share sheet and check it arrives: a Live Photo from Photos; a screenshot just taken (from its thumbnail); plain text from Notes; an attachment from Mail; an attachment from Messages. The simulator cannot make a Live Photo or take an in-device screenshot, and has no Notes or Mail, nor a Messages account to receive attachments.',
    title: 'Share extension sources the simulator lacks',
  },
  'contacts-import': {
    doByHand:
      'On a device with a throwaway account: Settings > Contacts > "Import phone contacts", allow access, and check the count of imported contacts shows; then in a throwaway team, Add members > "From your contacts" and check the contacts list opens. Remove the import after. The gate never imports: it would send the whole address book to the server.',
    title: 'Phone contacts import and adding team members from contacts',
  },
} satisfies Record<string, {title: string; doByHand: string}>

export type IosManualOnlyId = keyof typeof IOS_MANUAL_ONLY
