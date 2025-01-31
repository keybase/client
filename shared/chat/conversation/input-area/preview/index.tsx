import * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = {
  channelname: string
  onJoinChannel: () => void
  onLeaveChannel: () => void
}

export const ChannelPreview = (props: Props) => {
  const [clicked, setClicked] = React.useState<undefined | 'join' | 'leave'>(undefined)

  const _onClick = (join: boolean) => {
    setClicked(join ? 'join' : 'leave')
    if (join) {
      props.onJoinChannel()
    } else {
      props.onLeaveChannel()
    }
  }

  return (
    <Kb.Box style={styles.container}>
      <Kb.Text type="BodySemibold" negative={true}>
        Would you like to join #{props.channelname}?
      </Kb.Text>
      {!clicked && (
        <Kb.Box2 direction="horizontal" gap="tiny">
          <Kb.Text type="BodySemiboldLink" negative={true} onClick={() => _onClick(true)}>
            Yes, join
          </Kb.Text>
          <Kb.Text type="BodySemiboldLink" negative={true} onClick={() => _onClick(false)}>
            No, thanks
          </Kb.Text>
        </Kb.Box2>
      )}
      {!!clicked && (
        <Kb.Text type="BodySemibold" negative={true}>
          {clicked === 'join' ? 'Joining...' : 'Leaving...'}
        </Kb.Text>
      )}
    </Kb.Box>
  )
}

export default ChannelPreview

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.blue,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)
