import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {joinConversation} from '../status-actions'
import {useConversationThreadID, useConversationThreadSelector} from '../thread-context'

const Preview = () => {
  const conversationIDKey = useConversationThreadID()
  const channelname = useConversationThreadSelector(s => s.meta.channelname)
  const [clicked, setClicked] = React.useState<undefined | 'join' | 'leave'>(undefined)

  const _onClick = (join: boolean) => {
    setClicked(join ? 'join' : 'leave')
    if (join) {
      joinConversation(conversationIDKey)
    } else {
      C.Router2.leaveConversation(conversationIDKey)
    }
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" style={styles.container}>
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
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Kb.Styles.globalColors.blue,
        ...Kb.Styles.paddingV(Kb.Styles.globalMargins.tiny),
      },
    }) as const
)
export default Preview
