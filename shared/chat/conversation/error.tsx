import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'

const ConversationError = () => {
  const text = Chat.useChatContext(s => s.meta.snippet ?? '')
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} gap="small">
      <Kb.Text3 type="Header">There was an error loading this conversation.</Kb.Text3>
      <Kb.Text3 type="Body">
        The error is:
      </Kb.Text3>
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
