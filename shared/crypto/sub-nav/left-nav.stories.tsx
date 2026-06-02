import type {Meta, StoryObj} from '@storybook/react'
import LeftNav from './left-nav.desktop'
import * as Crypto from '@/constants/crypto'

const meta: Meta<typeof LeftNav> = {
  component: LeftNav,
  title: 'Crypto/LeftNav',
  args: {
    onClick: () => {},
    selected: Crypto.encryptTab,
  },
}
export default meta
type Story = StoryObj<typeof LeftNav>

export const EncryptSelected: Story = {
  args: {selected: Crypto.encryptTab},
}

export const DecryptSelected: Story = {
  args: {selected: Crypto.decryptTab},
}

export const SignSelected: Story = {
  args: {selected: Crypto.signTab},
}

export const VerifySelected: Story = {
  args: {selected: Crypto.verifyTab},
}
