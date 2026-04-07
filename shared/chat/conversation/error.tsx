import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'

const ConversationError = () => {
  const text = Chat.useChatContext(s => s.meta.snippet ?? '')
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} gap="small">
      <Kb.Text type="Header">There was an error loading this conversation.</Kb.Text>
      <Kb.Text type="Body">
        The error is:
      </Kb.Text>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.CopyableText style={styles.errorText} value={text} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        padding: Kb.Styles.globalMargins.medium,
      },
      errorText: {flexGrow: 1},
    }) as const
)

export default ConversationError
