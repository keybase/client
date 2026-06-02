import type {Meta, StoryObj} from '@storybook/react'
import QrImage from './qr-image'

const meta: Meta<typeof QrImage> = {
  component: QrImage,
  title: 'Provision/QrImage',
  args: {
    code: 'deadbeef cafe babe 1234 5678 abcd efgh ijkl mnop',
  },
}
export default meta
type Story = StoryObj<typeof QrImage>

export const Default: Story = {}

export const SmallCells: Story = {
  args: {
    cellSize: 8,
  },
}

export const LargeCells: Story = {
  args: {
    cellSize: 10,
  },
}
