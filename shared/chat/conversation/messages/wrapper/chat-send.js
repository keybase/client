// @flow
import * as React from 'react'
import {HOCTimers, Icon} from '../../../../common-adapters'
import type {IconType} from '../../../../common-adapters/icon.constants'

type IconStatus = 'encrypting' | 'sending' | 'sent' | 'error'
const statusToIcon: {[key: IconStatus]: IconType} = {
  encrypting: 'icon-message-status-encrypting-24',
  sending: 'icon-message-status-sending-24',
  sent: 'icon-message-status-sent-24',
  error: 'icon-message-status-error-24',
}

const encryptingTimeout = 600
const sentTimeout = 300

const SendIcon = (props: {status: IconStatus, style: any}) => (
  <Icon type={statusToIcon[props.status]} style={{width: 24, height: 16, ...props.style}} />
)

type Props = {
  sent: boolean,
  failed: boolean,
  setTimeout: typeof setTimeout,
  clearTimeout: typeof clearTimeout,
  style: any,
}

type State = {iconStatus: IconStatus, visible: boolean}
class SendAnimation extends React.Component<Props, State> {
  state = {iconStatus: 'encrypting', visible: true}

  encryptingTimeoutID: TimeoutID
  sentTimeoutID: TimeoutID

  _setStatus(iconStatus: IconStatus) {
    this.setState({iconStatus})
  }

  _setVisible(visible: boolean) {
    this.setState({visible})
  }

  _onSent() {
    this._setStatus('sent')
    this.sentTimeoutID = this.props.setTimeout(() => this._setVisible(false), sentTimeout)
    this.props.clearTimeout(this.encryptingTimeoutID)
  }

  _onFailed() {
    this._setStatus('error')
    this.props.clearTimeout(this.encryptingTimeoutID)
    this.props.clearTimeout(this.sentTimeoutID)
  }

  componentWillMount() {
    if (!(this.props.sent || this.props.failed)) {
      this.encryptingTimeoutID = this.props.setTimeout(() => this._setStatus('sending'), encryptingTimeout)
    } else if (this.props.failed) {
      this._onFailed()
    } else if (this.props.sent) {
      this._setVisible(false)
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.failed && !this.props.failed) {
      this._onFailed()
    } else if (nextProps.sent && !this.props.sent) {
      this._onSent()
    }
  }

  render() {
    if (!this.state.visible) {
      return null
    }
    return <SendIcon status={this.state.iconStatus} style={this.props.style} />
  }
}

const TimedSendAnimation = HOCTimers(SendAnimation)

export default TimedSendAnimation
