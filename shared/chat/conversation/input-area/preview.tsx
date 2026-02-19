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
    <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" style={styles.container}>
      <Kb.Text3 type="BodySemibold" negative={true}>
        Would you like to join #{channelname}?
      </Kb.Text3>
      {!clicked && (
        <Kb.Box2 direction="horizontal" gap="tiny">
          <Kb.Text3 type="BodySemiboldLink" negative={true} onClick={() => _onClick(true)}>
            Yes, join
          </Kb.Text3>
          <Kb.Text3 type="BodySemiboldLink" negative={true} onClick={() => _onClick(false)}>
            No, thanks
          </Kb.Text3>
        </Kb.Box2>
      )}
      {!!clicked && (
        <Kb.Text3 type="BodySemibold" negative={true}>
          {clicked === 'join' ? 'Joining...' : 'Leaving...'}
        </Kb.Text3>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Kb.Styles.globalColors.blue,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)
export default Preview
