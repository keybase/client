import type {Meta, StoryObj} from '@storybook/react'
import {OutputInfoBanner} from './output'
import * as Kb from '@/common-adapters'

const meta: Meta<typeof OutputInfoBanner> = {
  component: OutputInfoBanner,
  title: 'Crypto/OutputInfoBanner',
  args: {
    outputStatus: 'success',
  },
}
export default meta
type Story = StoryObj<typeof OutputInfoBanner>

export const SignSuccess: Story = {
  args: {
    outputStatus: 'success',
    children: (
      <Kb.Text type="BodySmallSemibold" center={true}>
        This is your signed message, using Saltpack. Anyone who has it can verify you signed it.
      </Kb.Text>
    ),
  },
}

export const EncryptSuccess: Story = {
  args: {
    outputStatus: 'success',
    children: (
      <Kb.Text type="BodySmallSemibold" center={true}>
        This is your encrypted message, using Saltpack.
      </Kb.Text>
    ),
  },
}

export const NotSuccess: Story = {
  args: {
    outputStatus: 'pending',
    children: (
      <Kb.Text type="BodySmallSemibold" center={true}>
        This should not be visible.
      </Kb.Text>
    ),
  },
}
