import type {Meta, StoryObj} from '@storybook/react'
import RemoveAccount from './remove-account'

const meta: Meta<typeof RemoveAccount> = {
  component: RemoveAccount,
  title: 'Wallets/RemoveAccount',
}
export default meta
type Story = StoryObj<typeof RemoveAccount>

export const WithBalance: Story = {
  args: {
    accountID: 'GABC1234',
    name: 'My Savings',
    balanceDescription: '125.0000000 XLM',
  },
}

export const ZeroBalance: Story = {
  args: {
    accountID: 'GABC5678',
    name: 'Empty Wallet',
    balanceDescription: '0.0000000 XLM',
  },
}

export const LongName: Story = {
  args: {
    accountID: 'GABC9999',
    name: 'My Very Long Wallet Account Name That Might Wrap',
    balanceDescription: '9999.9999999 XLM',
  },
}
