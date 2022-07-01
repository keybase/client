import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

type AnimationStatus =
  | 'encrypting'
  | 'encryptingExploding'
  | 'error'
  | 'sending'
  | 'sendingExploding'
  | 'sent'
const statusToIcon: {[K in AnimationStatus]: Kb.AnimationType} = {
  encrypting: 'messageStatusEncrypting',
  encryptingExploding: 'messageStatusEncryptingExploding',
  error: 'messageStatusError',
  sending: 'messageStatusSending',
  sendingExploding: 'messageStatusSendingExploding',
  sent: 'messageStatusSent',
}
const statusToIconDark: {[K in AnimationStatus]: Kb.AnimationType} = {
  encrypting: 'darkMessageStatusEncrypting',
  encryptingExploding: 'darkMessageStatusEncryptingExploding',
  error: 'darkMessageStatusError',
  sending: 'darkMessageStatusSending',
  sendingExploding: 'darkMessageStatusSendingExploding',
  sent: 'darkMessageStatusSent',
}

const encryptingTimeout = 600
const sentTimeout = 400

const shownEncryptingSet = new Set()

type Props = {
  isExploding: boolean
  sent: boolean
  failed: boolean
  id?: number
  style?: any
}

type State = {
  animationStatus: AnimationStatus
  visible: boolean
}

class SendIndicator extends React.Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    const state: State = {animationStatus: 'encrypting', visible: !props.sent}

    if (!(this.props.sent || this.props.failed)) {
      // Only show the `encrypting` icon for messages once
      if (shownEncryptingSet.has(this.props.id)) {
        state.animationStatus = 'encrypting'
      } else {
        state.animationStatus = 'sending'
      }
    } else if (this.props.failed) {
      // previously failed message
      state.animationStatus = 'error'
    } else if (this.props.sent) {
      // previously sent message
      state.visible = false
    }

    this.state = state
  }

  encryptingTimeoutID?: ReturnType<typeof setInterval>
  sentTimeoutID?: ReturnType<typeof setInterval>

  _setStatus(animationStatus: AnimationStatus) {
    this.setState({animationStatus})
  }

  _setVisible(visible: boolean) {
    this.setState({visible})
  }

  _onSent() {
    this._setStatus('sent')
    this.sentTimeoutID && clearTimeout(this.sentTimeoutID)
    this.sentTimeoutID = setTimeout(() => this._setVisible(false), sentTimeout)
    this.encryptingTimeoutID && clearTimeout(this.encryptingTimeoutID)
  }

  _onFailed() {
    this._setStatus('error')
    this.encryptingTimeoutID && clearTimeout(this.encryptingTimeoutID)
    this.sentTimeoutID && clearTimeout(this.sentTimeoutID)
  }

  _onResend() {
    this._setVisible(true)
    this._setStatus('sending')
  }

  componentDidMount() {
    if (!(this.props.sent || this.props.failed)) {
      // Only show the `encrypting` icon for messages once
      if (!shownEncryptingSet.has(this.props.id)) {
        this._setStatus('encrypting')
        if (!this.encryptingTimeoutID) {
          this.encryptingTimeoutID = setTimeout(() => this._setStatus('sending'), encryptingTimeout)
        }
        shownEncryptingSet.add(this.props.id)
      }
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.failed && !prevProps.failed) {
      this._onFailed()
    } else if (this.props.sent && !prevProps.sent) {
      this._onSent()
    } else if (!this.props.failed && prevProps.failed) {
      this._onResend()
    }
  }

  componentWillUnmount() {
    this.encryptingTimeoutID && clearTimeout(this.encryptingTimeoutID)
    this.sentTimeoutID && clearTimeout(this.sentTimeoutID)
  }

  private animationType = () => {
    let animationType = Styles.isDarkMode()
      ? statusToIconDark[this.state.animationStatus]
      : statusToIcon[this.state.animationStatus]
    // There is no exploding-error state
    if (this.props.isExploding && this.state.animationStatus !== 'error') {
      animationType = `${animationType}Exploding` as Kb.AnimationType
    }
    return animationType
  }

  render() {
    if (!this.state.visible || (this.props.isExploding && this.state.animationStatus === 'sent')) {
      return null
    }
    return (
      <Kb.Animation
        animationType={this.animationType()}
        className="sendingStatus"
        containerStyle={this.props.style}
        style={Styles.collapseStyles([
          styles.animation,
          this.state.visible ? styles.visible : styles.invisible,
        ])}
      />
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      animation: Styles.platformStyles({
        common: {
          height: 20,
          width: 20,
        },
        isMobile: {
          backgroundColor: Styles.globalColors.white,
        },
      }),
      invisible: {opacity: 0},
      visible: {opacity: 1},
    } as const)
)

const TimedSendIndicator = SendIndicator

export default TimedSendIndicator
