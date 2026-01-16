import {isMobile} from './platform'

export const saltpackDocumentation = 'https://saltpack.org'
export const inputDesktopMaxHeight = {maxHeight: '30%'} as const
export const outputDesktopMaxHeight = {maxHeight: '70%'} as const

export const encryptTab = 'encryptTab'
export const decryptTab = 'decryptTab'
export const signTab = 'signTab'
export const verifyTab = 'verifyTab'

// Output route keys - Mobile only
export const encryptOutput = 'encryptOutput'
export const decryptOutput = 'decryptOutput'
export const signOutput = 'signOutput'
export const verifyOutput = 'verifyOutput'

// Update me once Saltpack works with files on mobile.
export const infoMessage = {
  decrypt: isMobile
    ? 'Decrypt messages encrypted with Saltpack.'
    : 'Decrypt any ciphertext or .encrypted.saltpack file.',
  encrypt: "Encrypt to anyone, even if they're not on Keybase yet.",
  sign: 'Add your cryptographic signature to a message or file.',
  verify: isMobile ? 'Verify a signed message.' : 'Verify any signed text or .signed.saltpack file.',
}

export const Tabs = [
  {
    description: infoMessage.encrypt,
    icon: 'iconfont-lock' as const,
    illustration: 'icon-encrypt-64' as const,
    tab: encryptTab,
    title: 'Encrypt',
  },
  {
    description: infoMessage.decrypt,
    icon: 'iconfont-unlock' as const,
    illustration: 'icon-decrypt-64' as const,
    tab: decryptTab,
    title: 'Decrypt',
  },
  {
    description: infoMessage.sign,
    icon: 'iconfont-check' as const,
    illustration: 'icon-sign-64' as const,
    tab: signTab,
    title: 'Sign',
  },
  {
    description: infoMessage.verify,
    icon: 'iconfont-verify' as const,
    illustration: 'icon-verify-64' as const,
    tab: verifyTab,
    title: 'Verify',
  },
] as const

export const Operations = {
  Decrypt: 'decrypt',
  Encrypt: 'encrypt',
  Sign: 'sign',
  Verify: 'verify',
} as const
