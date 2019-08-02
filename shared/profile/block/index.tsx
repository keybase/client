import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/profile'

type Props = {
  username: string
  errorMessage?: string
  idle: boolean
  onClose: () => void
  onSubmit: () => void
  isWaiting: boolean
}

class Block extends React.Component<Props> {
  componentDidUpdate(prevProps: Props) {
    if (!prevProps.idle && this.props.idle) {
      this.props.onClose()
    }
  }

  render() {
    const props = this.props
    const modalProps = {
      confirmText: 'Yes, block them',
      description:
        'This will hide them from your followers and suggestions, and prevent them from creating new conversations or teams with you. Note that they may be able to find out that you block them.',
      error: props.errorMessage || undefined,
      onCancel: props.onClose,
      onConfirm: props.onSubmit,
      prompt: `Block ${props.username}?`,
      waitingKey: Constants.blockUserWaitingKey,
    }
    return <Kb.ConfirmModal {...modalProps} />
  }
}

export default Block
