import type {Meta, StoryObj} from '@storybook/react'
import Upload from './upload'

const meta: Meta<typeof Upload> = {
  component: Upload,
  title: 'FS/Upload',
  args: {
    showing: true,
    files: 0,
    totalSyncingBytes: 0,
    timeLeft: '',
  },
}
export default meta
type Story = StoryObj<typeof Upload>

export const Showing: Story = {
  args: {
    showing: true,
    files: 3,
    fileName: 'photo.jpg',
    totalSyncingBytes: 1024 * 1024,
    timeLeft: '2 minutes',
  },
}

export const SingleFile: Story = {
  args: {
    showing: true,
    files: 1,
    fileName: 'document.pdf',
    totalSyncingBytes: 512 * 1024,
    timeLeft: '30 seconds',
  },
}

export const Done: Story = {
  args: {
    showing: true,
    files: 0,
    totalSyncingBytes: 0,
    timeLeft: '',
  },
}

export const SmallMode: Story = {
  args: {
    showing: true,
    files: 2,
    fileName: 'report.docx',
    totalSyncingBytes: 256 * 1024,
    timeLeft: '1 minute',
    smallMode: true,
  },
}

export const Hidden: Story = {
  args: {
    showing: false,
    files: 0,
    totalSyncingBytes: 0,
    timeLeft: '',
  },
}
