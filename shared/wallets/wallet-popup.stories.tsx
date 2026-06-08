import type {Meta, StoryObj} from '@storybook/react'
import * as Kb from '@/common-adapters'
import WalletPopup from './wallet-popup'

const meta: Meta<typeof WalletPopup> = {
  component: WalletPopup,
  title: 'Wallets/WalletPopup',
  args: {
    children: (
      <Kb.Box2 direction="vertical" centerChildren={true} gap="small">
        <Kb.Text type="Header">Wallet content here</Kb.Text>
        <Kb.Text type="Body">Some descriptive text about this wallet action.</Kb.Text>
      </Kb.Box2>
    ),
  },
}
export default meta
type Story = StoryObj<typeof WalletPopup>

export const NoButtons: Story = {}

export const WithButtons: Story = {
  args: {
    bottomButtons: [
      <Kb.Button key={0} label="Cancel" type="Dim" onClick={() => {}} />,
      <Kb.Button key={1} label="Confirm" type="Success" onClick={() => {}} />,
    ],
  },
}

export const ColumnButtons: Story = {
  args: {
    buttonBarDirection: 'column',
    bottomButtons: [
      <Kb.Button key={0} fullWidth={true} label="Primary Action" type="Success" onClick={() => {}} />,
      <Kb.Button key={1} fullWidth={true} label="Cancel" type="Dim" onClick={() => {}} />,
    ],
  },
}
