// @flow
import * as React from 'react'
import {Icon} from '../common-adapters'
import type {IconType} from '../common-adapters/icon.constants'

type Status = 'encrypting' | 'sending' | 'sent' | 'error'
const statusToIcon: {[key: Status]: IconType} = {
  encrypting: 'icon-message-status-encrypting-24',
  sending: 'icon-message-status-sending-24',
  sent: 'icon-message-status-sent-24',
  error: 'icon-message-status-error-24',
}

const SendIcon = (props: {status: Status}) => <Icon type={statusToIcon[props.status]} />

type Props = {
  status: Status,
}

type State = {iconStatus: Status}
class SendAnimation extends React.Component<Props, State> {
  state = {iconStatus: 'encrypting'}

  setStatus(iconStatus: Status) {
    this.setState({iconStatus})
  }

  componentWillRecieveProps(nextProps: Props) {}

  render() {
    return <SendIcon status={this.state.iconStatus} />
  }
}

export {SendAnimation}
