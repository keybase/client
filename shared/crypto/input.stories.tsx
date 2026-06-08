import type {Meta, StoryObj} from '@storybook/react'
import {CryptoBanner} from './input'
import type {CommonState} from './helpers'

const makeState = (overrides: Partial<CommonState> = {}): CommonState => ({
  bytesComplete: 0,
  bytesTotal: 0,
  errorMessage: '',
  inProgress: false,
  input: '',
  inputType: 'text',
  output: '',
  outputSenderFullname: undefined,
  outputSenderUsername: undefined,
  outputSigned: false,
  outputStatus: undefined,
  outputType: undefined,
  outputValid: false,
  warningMessage: '',
  ...overrides,
})

const meta: Meta<typeof CryptoBanner> = {
  component: CryptoBanner,
  title: 'Crypto/CryptoBanner',
  args: {
    infoMessage: 'Add your cryptographic signature to a message or file.',
    state: makeState(),
  },
}
export default meta
type Story = StoryObj<typeof CryptoBanner>

export const InfoSign: Story = {
  args: {
    infoMessage: 'Add your cryptographic signature to a message or file.',
    state: makeState(),
  },
}

export const InfoEncrypt: Story = {
  args: {
    infoMessage: "Encrypt to anyone, even if they're not on Keybase yet.",
    state: makeState(),
  },
}

export const ErrorState: Story = {
  args: {
    state: makeState({errorMessage: 'This Saltpack format is unexpected. Did you mean to decrypt it?'}),
  },
}

export const WarningState: Story = {
  args: {
    state: makeState({warningMessage: 'Note: Encrypted for an SBS user who has not joined Keybase yet.'}),
  },
}

export const ErrorAndWarning: Story = {
  args: {
    state: makeState({
      errorMessage: 'Failed to sign text.',
      warningMessage: 'Warning: something looks off.',
    }),
  },
}
