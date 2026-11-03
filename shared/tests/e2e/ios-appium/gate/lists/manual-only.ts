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
  'phone-new-device': {
    doByHand: 'On a fresh install, add this phone as a new device from an existing device (scan or type the code), then check it lands signed in.',
    title: 'Phone as a new device',
  },
} satisfies Record<string, {title: string; doByHand: string}>

export type IosManualOnlyId = keyof typeof IOS_MANUAL_ONLY
