import type * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

const ConversationError = (p: OwnProps) => {
  const {conversationIDKey} = p
  const text = Container.useSelector(state => Constants.getMeta(state, conversationIDKey).snippet ?? '')
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      body: {
        marginTop: Styles.globalMargins.small,
      },
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        padding: Styles.globalMargins.medium,
        width: '100%',
      },
      errorBox: {
        ...Styles.globalStyles.flexBoxRow,
        marginTop: Styles.globalMargins.small,
      },
      errorText: {flexGrow: 1},
    } as const)
)

export default ConversationError
