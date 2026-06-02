import type {Meta, StoryObj} from '@storybook/react'
import PieSlice from '@/fs/common/pie-slice'
import * as Kb from '@/common-adapters'

// SyncingFolders default export wraps store hooks; story the inner pure UI directly.
const SyncingFoldersUI = ({
  progress,
  tooltip,
  negative,
}: {
  progress: number
  tooltip: string
  negative?: boolean
}) => (
  <Kb.WithTooltip tooltip={tooltip} containerStyle={{alignSelf: 'center'}}>
    <Kb.Box2 direction="horizontal" alignItems="center">
      <PieSlice degrees={progress * 360} animated={false} negative={negative} />
      <Kb.Text type="BodyTiny" negative={negative} style={{marginLeft: 5}}>
        Syncing folders...
      </Kb.Text>
    </Kb.Box2>
  </Kb.WithTooltip>
)

const meta: Meta<typeof SyncingFoldersUI> = {
  component: SyncingFoldersUI,
  title: 'RouterV2/SyncingFolders',
  args: {
    progress: 0.5,
    tooltip: '50 MB / 100 MB',
    negative: false,
  },
}
export default meta
type Story = StoryObj<typeof SyncingFoldersUI>

export const HalfwayDone: Story = {
  args: {
    progress: 0.5,
    tooltip: '50 MB / 100 MB',
  },
}

export const AlmostDone: Story = {
  args: {
    progress: 0.9,
    tooltip: '90 MB / 100 MB',
  },
}

export const JustStarted: Story = {
  args: {
    progress: 0.05,
    tooltip: '5 MB / 100 MB',
  },
}

export const NegativeVariant: Story = {
  args: {
    progress: 0.6,
    tooltip: '60 MB / 100 MB',
    negative: true,
  },
}
