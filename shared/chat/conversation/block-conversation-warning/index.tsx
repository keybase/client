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

type State = {
  reportAbuse: boolean
}

class BlockConversationWarning extends React.Component<Props, State> {
  state = {
    reportAbuse: false,
  }

  _onConfirm = () => (this.state.reportAbuse ? this.props.onBlockAndReport() : this.props.onBlock())

  render() {
    return (
      <Kb.ConfirmModal
        icon="iconfont-block"
        iconColor={Styles.globalColors.red}
        confirmText="Yes, block them"
        content={
          <Kb.Checkbox
            checked={this.state.reportAbuse}
            label="Report abuse"
            onCheck={checked => this.setState({reportAbuse: checked})}
          />
        }
        description="You won’t see this conversation anymore. They won’t be notified or know you’ve blocked the conversation."
        onCancel={this.props.onBack}
        onConfirm={this._onConfirm}
        prompt={`Block the conversation with ${this.props.participants}?`}
      />
    )
  }
}

export default BlockConversationWarning
