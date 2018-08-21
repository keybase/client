// @flow
import * as React from 'react'
import Button, {type Props as ButtonProps} from './button'
import {connect, type TypedState, setDisplayName} from '../util/container'
import * as WaitingConstants from '../constants/waiting'

export type OwnProps = ButtonProps & {
  waitingKey: ?string,
}

export type Props = ButtonProps & {
  storeWaiting: boolean,
  waitingKey: ?string,
}

/* Waiting button is a <Button /> with handling of waiting states.
 *
 * There are two forms:
 *  waitingKey is null: The spinner activates as soon as the button is clicked,
 *  and stays there until the component's unmounted.  This can be used in
 *  places where the end of an async action will coincide with the component
 *  unmounting.
 *
 *  waitingKey is non-null: The spinner follows the given key in our generic
 *  waiting store (store.waiting), which will be set by a saga somewhere.
 */

class WaitingButton extends React.Component<Props, {localWaiting: boolean}> {
  state = {localWaiting: false}

  _onClick = (event: SyntheticEvent<>) => {
    if (!this.props.waitingKey) {
      this.setState({localWaiting: true})
    }
    this.props.onClick && this.props.onClick(event)
  }

  render = () => (
    <Button
      {...this.props}
      onClick={this._onClick}
      waiting={this.props.storeWaiting || this.state.localWaiting}
    />
  )
}

const mapStateToProps = (state: TypedState, ownProps) => {
  const waitingKey = ownProps.waitingKey || ''
  return {
    storeWaiting: WaitingConstants.anyWaiting(state, waitingKey),
  }
}

const ConnectedWaitingButton = connect(mapStateToProps, () => ({}), (s, d, o) => ({...s, ...d, ...o}))(
  setDisplayName('WaitingButton')(WaitingButton)
)
export default ConnectedWaitingButton
