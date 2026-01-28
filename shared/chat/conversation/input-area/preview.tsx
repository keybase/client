import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Kb from '@/common-adapters'

const Preview = () => {
  const meta = Chat.useChatContext(s => s.meta)
  const onJoinChannel = Chat.useChatContext(s => s.dispatch.joinConversation)
  const onLeaveChannel = Chat.useChatContext(s => s.dispatch.leaveConversation)
  const {channelname} = meta
  const [clicked, setClicked] = React.useState<undefined | 'join' | 'leave'>(undefined)

  const _onClick = (join: boolean) => {
    setClicked(join ? 'join' : 'leave')
    if (join) {
      onJoinChannel()
    } else {
      onLeaveChannel()
    }
  }

  return (
    <Kb.Box style={styles.container}>
      <Kb.Text type="BodySemibold" negative={true}>
        Would you like to join #{channelname}?
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
export default Preview
