import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/profile'

type Props = {
  username: string
  errorMessage?: string | null
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
    let errorBox = null
    if (props.errorMessage) {
      errorBox = (
        <Kb.Box style={styles.errorBanner}>
          <Kb.Text center={!Styles.isMobile} style={styles.errorBannerText} type="BodySemibold">
            {props.errorMessage}
          </Kb.Text>
        </Kb.Box>
      )
    }
    const modalProps = {
      confirmText: 'Yes, block them',
      description:
        'This will hide them from your followers and suggestions, and prevent them from creating new conversations or teams with you. Note that they may be able to find out that you block them.',
      header: errorBox,
      onCancel: props.onClose,
      onConfirm: props.onSubmit,
      prompt: `Block ${props.username}`,
      waitingKey: Constants.blockUserWaitingKey,
    }
    return <Kb.ConfirmModal {...modalProps} />
  }
}

const styles = Styles.styleSheetCreate({
  errorBanner: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.red,
    justifyContent: 'center',
    minHeight: Styles.globalMargins.large,
    padding: Styles.globalMargins.tiny,
    width: '100%',
  },
  errorBannerText: {
    color: Styles.globalColors.white,
    maxWidth: 512,
  },
})

export default Block
