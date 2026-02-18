import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'

const ConversationError = () => {
  const text = Chat.useChatContext(s => s.meta.snippet ?? '')
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Text type="Header">There was an error loading this conversation.</Kb.Text>
      <Kb.Text style={styles.body} type="Body">
        The error is:
      </Kb.Text>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.errorBox}>
        <Kb.CopyableText style={styles.errorText} value={text} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      body: {marginTop: Kb.Styles.globalMargins.small},
      container: {
        padding: Kb.Styles.globalMargins.medium,
      },
      errorBox: {
        marginTop: Kb.Styles.globalMargins.small,
      },
      errorText: {flexGrow: 1},
    }) as const
)

export default ConversationError
