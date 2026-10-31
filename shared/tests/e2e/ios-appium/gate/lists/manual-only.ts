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
    doByHand: 'On a fresh install: the notification and camera permission prompts appear when the app first needs them, and allowing each works.',
    title: 'OS permission prompts the simulator cannot pre-grant',
  },
  'face-id': {
    doByHand: 'On a device with Face ID: any action the app gates behind Face ID or the passcode prompts and proceeds on success.',
    title: 'Face ID or passcode prompts',
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
  'block-modal-switches': {
    doByHand:
      "Block a throwaway account from a chat, then open its profile's Manage blocking: tap the Block and Hide-from-followers switches (and their labels) off, then Finish; the account is unblocked.",
    title: "Tapping the block modal's switches",
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
  'phone-new-device': {
    doByHand: 'On a fresh install, add this phone as a new device from an existing device (scan or type the code), then check it lands signed in.',
    title: 'Phone as a new device',
  },
} satisfies Record<string, {title: string; doByHand: string}>

export type IosManualOnlyId = keyof typeof IOS_MANUAL_ONLY
