import type {Meta, StoryObj} from '@storybook/react'
import type * as T from '@/constants/types'
import * as RPCGen from '@/constants/rpc/rpc-gen'
import Pinentry from './index.desktop'

const makeFeature = (overrides: Partial<T.RPCGen.Feature> = {}): T.RPCGen.Feature => ({
  allow: true,
  defaultValue: false,
  label: 'Show typing',
  readonly: false,
  ...overrides,
})

const meta: Meta<typeof Pinentry> = {
  component: Pinentry,
  title: 'Pinentry/Pinentry',
  args: {
    onCancel: () => {},
    onSubmit: () => {},
    prompt: 'Enter your passphrase',
    type: RPCGen.PassphraseType.passPhrase,
  },
}
export default meta
type Story = StoryObj<typeof Pinentry>

export const Passphrase: Story = {
  args: {
    prompt: 'Enter your Keybase passphrase',
    type: RPCGen.PassphraseType.passPhrase,
  },
}

export const PassphraseWithShowTyping: Story = {
  args: {
    prompt: 'Enter your Keybase passphrase',
    type: RPCGen.PassphraseType.passPhrase,
    showTyping: makeFeature({allow: true, defaultValue: false, label: 'Show typing'}),
  },
}

export const PaperKey: Story = {
  args: {
    prompt: 'Enter your paper key',
    type: RPCGen.PassphraseType.paperKey,
  },
}

export const PaperKeyWithError: Story = {
  args: {
    prompt: 'Enter your paper key',
    type: RPCGen.PassphraseType.paperKey,
    retryLabel: 'Incorrect paper key, please try again',
  },
}

export const VerifyPassphrase: Story = {
  args: {
    prompt: 'Verify your passphrase to continue',
    type: RPCGen.PassphraseType.verifyPassPhrase,
  },
}

export const CustomLabels: Story = {
  args: {
    prompt: 'Unlock your encrypted folder',
    type: RPCGen.PassphraseType.passPhrase,
    submitLabel: 'Unlock',
  },
}
