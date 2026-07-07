import * as Kb from '@/common-adapters'
import {useThreadMeta} from './thread-context'

const ConversationError = () => {
  const text = useThreadMeta(m => m.snippet) ?? ''
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} padding="medium" gap="small">
      <Kb.Text type="Header">There was an error loading this conversation.</Kb.Text>
      <Kb.Text type="Body">The error is:</Kb.Text>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.CopyableText style={styles.errorText} value={text} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      errorText: {flexGrow: 1},
    }) as const
)

export default ConversationError
