import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Kb from '../../../common-adapters/index'
import * as Styles from '../../../styles'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  onBack: () => void
  onBlock: () => void
  onBlockAndReport: () => void
  participants: string
}

const BlockConversationWarning = (props: Props) => {
  const [reportAbuse, setReportAbuse] = React.useState(false)

  const _onConfirm = () => (reportAbuse ? props.onBlockAndReport() : props.onBlock())

  const baseDescription = "You won't see this conversation anymore. "
  const participantDescription = props.participants.includes(',') // if there's more than 1 other user
    ? 'They won’t be notified or know you’ve blocked it.'
    : "They won’t be notified that you've blocked them, but they might be able to figure it out."

  return (
    <Kb.ConfirmModal
      icon="iconfont-block"
      iconColor={Styles.globalColors.red}
      confirmText="Yes, block them"
      content={
        <Kb.Checkbox
          checked={reportAbuse}
          label="Report abuse"
          onCheck={checked => setReportAbuse(checked)}
        />
      }
      description={baseDescription + participantDescription}
      onCancel={props.onBack}
      onConfirm={_onConfirm}
      prompt={`Block the conversation with ${props.participants}?`}
    />
  )
}

export default BlockConversationWarning
