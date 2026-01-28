import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'

const ConversationError = () => {
  const text = Chat.useChatContext(s => s.meta.snippet ?? '')
  return (
    <Kb.Box style={styles.container}>
      <Kb.Text type="Header">There was an error loading this conversation.</Kb.Text>
      <Kb.Text style={styles.body} type="Body">
        The error is:
      </Kb.Text>
      <Kb.Box style={styles.errorBox}>
        <Kb.CopyableText style={styles.errorText} value={text} />
      </Kb.Box>
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      body: {marginTop: Kb.Styles.globalMargins.small},
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        padding: Kb.Styles.globalMargins.medium,
        width: '100%',
      },
      errorBox: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        marginTop: Kb.Styles.globalMargins.small,
      },
      errorText: {flexGrow: 1},
    }) as const
)

export default ConversationError
