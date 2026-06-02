import type {Meta, StoryObj} from '@storybook/react'
import NavRow from './nav-row'

const meta: Meta<typeof NavRow> = {
  component: NavRow,
  title: 'Crypto/NavRow',
  args: {
    tab: 'encryptTab',
    onClick: () => {},
  },
}
export default meta
type Story = StoryObj<typeof NavRow>

export const DesktopEncrypt: Story = {
  args: {
    title: 'Encrypt',
    icon: 'iconfont-lock',
    isSelected: false,
  },
}

export const DesktopEncryptSelected: Story = {
  args: {
    title: 'Encrypt',
    icon: 'iconfont-lock',
    isSelected: true,
  },
}

export const DesktopDecrypt: Story = {
  args: {
    title: 'Decrypt',
    tab: 'decryptTab',
    icon: 'iconfont-unlock',
    isSelected: false,
  },
}

export const DesktopSign: Story = {
  args: {
    title: 'Sign',
    tab: 'signTab',
    icon: 'iconfont-check',
    isSelected: false,
  },
}

export const DesktopVerify: Story = {
  args: {
    title: 'Verify',
    tab: 'verifyTab',
    icon: 'iconfont-verify',
    isSelected: false,
  },
}

export const MobileEncrypt: Story = {
  args: {
    title: 'Encrypt',
    description: "Encrypt to anyone, even if they're not on Keybase yet.",
    illustration: 'icon-encrypt-64',
  },
}

export const MobileDecrypt: Story = {
  args: {
    title: 'Decrypt',
    tab: 'decryptTab',
    description: 'Decrypt any ciphertext or .encrypted.saltpack file.',
    illustration: 'icon-decrypt-64',
  },
}
