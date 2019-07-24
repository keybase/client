import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

type IconStatus = 'encrypting' | 'sending' | 'sent' | 'error'
const statusToIcon: {[K in IconStatus]: Kb.IconType} = {
  encrypting: 'icon-message-status-encrypting-24',
  error: 'icon-message-status-error-24',
  sending: 'icon-message-status-sending-24',
  sent: 'icon-message-status-sent-24',
}

const encryptingTimeout = 600
const sentTimeout = 400

const shownEncryptingSet = new Set()

type Props = Kb.PropsWithTimer<{
  sent: boolean
  failed: boolean
  id?: number
  style?: any
}>

type State = {
  iconStatus: IconStatus
  visible: boolean
}

class SendIndicator extends React.Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {iconStatus: 'encrypting', visible: !props.sent}
  }

  encryptingTimeoutID?: NodeJS.Timeout
  sentTimeoutID?: NodeJS.Timeout

  _setStatus(iconStatus: IconStatus) {
    this.setState({iconStatus})
  }

  _setVisible(visible: boolean) {
    this.setState({visible})
  }

  _onSent() {
    this._setStatus('sent')
    this.sentTimeoutID && this.props.clearTimeout(this.sentTimeoutID)
    this.sentTimeoutID = this.props.setTimeout(() => this._setVisible(false), sentTimeout)
    this.encryptingTimeoutID && this.props.clearTimeout(this.encryptingTimeoutID)
  }

  _onFailed() {
    this._setStatus('error')
    this.encryptingTimeoutID && this.props.clearTimeout(this.encryptingTimeoutID)
    this.sentTimeoutID && this.props.clearTimeout(this.sentTimeoutID)
  }

  _onResend() {
    this._setVisible(true)
    this._setStatus('sending')
  }

  componentDidMount() {
    if (!(this.props.sent || this.props.failed)) {
      // Only show the `encrypting` icon for messages once
      if (!shownEncryptingSet.has(this.props.id)) {
        this.encryptingTimeoutID = this.props.setTimeout(() => this._setStatus('sending'), encryptingTimeout)
        shownEncryptingSet.add(this.props.id)
      } else {
        this._setStatus('sending')
      }
    } else if (this.props.failed) {
      // previously failed message
      this._onFailed()
    } else if (this.props.sent) {
      // previously sent message
      this._setVisible(false)
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
    this.encryptingTimeoutID && this.props.clearTimeout(this.encryptingTimeoutID)
    this.sentTimeoutID && this.props.clearTimeout(this.sentTimeoutID)
  }

  render() {
    if (!this.state.visible) {
      return null
    }
    return (
      <Kb.Icon
        type={statusToIcon[this.state.iconStatus]}
        style={Styles.collapseStyles([
          this.props.style,
          this.state.visible ? styles.visible : styles.invisible,
        ])}
      />
    )
  }
}

const styles = Styles.styleSheetCreate({
  invisible: {height: 16, opacity: 0, width: 24},
  visible: {height: 16, opacity: 1, width: 24},
})

const TimedSendIndicator = Kb.HOCTimers(SendIndicator)

export default TimedSendIndicator
