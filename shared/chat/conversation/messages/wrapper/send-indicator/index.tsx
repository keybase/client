import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

type AnimationStatus = 'encrypting' | 'error' | 'sending' | 'sent'
const statusToIcon: {[K in AnimationStatus]: Kb.AnimationType} = {
  encrypting: 'messageStatusEncrypting',
  error: 'messageStatusError',
  sending: 'messageStatusSending',
  sent: 'messageStatusSent',
}
const statusToIconDark: {[K in AnimationStatus]: Kb.AnimationType} = {
  encrypting: 'darkMessageStatusEncrypting',
  error: 'darkMessageStatusError',
  sending: 'darkMessageStatusSending',
  sent: 'darkMessageStatusSent',
}

const encryptingTimeout = 600
const sentTimeout = 400

const shownEncryptingSet = new Set()

type Props = {
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
        this.encryptingTimeoutID = setTimeout(() => this._setStatus('sending'), encryptingTimeout)
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

  render() {
    if (!this.state.visible) {
      return null
    }
    return (
      <Kb.Animation
        animationType={
          Styles.isDarkMode()
            ? statusToIconDark[this.state.animationStatus]
            : statusToIcon[this.state.animationStatus]
        }
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
          height: 24,
          width: 36,
        },
        isMobile: {
          backgroundColor: Styles.globalColors.white,
          height: 32,
          width: 48,
        },
      }),
      invisible: {opacity: 0},
      visible: {opacity: 1},
    } as const)
)

const TimedSendIndicator = SendIndicator

export default TimedSendIndicator
