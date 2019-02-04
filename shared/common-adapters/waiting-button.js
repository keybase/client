// @flow
import * as React from 'react'
import Button, {type Props as ButtonProps} from './button'
import {namedConnect} from '../util/container'
import * as WaitingConstants from '../constants/waiting'

export type OwnProps = {|
  ...ButtonProps,
  onlyDisable?: boolean, // Must supply waiting key if this is true
  waitingKey: ?string,
|}

export type Props = {|
  ...ButtonProps,
  onlyDisable?: boolean,
  storeWaiting: boolean,
  waitingKey: ?string,
|}

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

  render = () => {
    if (this.props.onlyDisable && !this.props.waitingKey) {
      throw new Error('WaitingButton onlyDisable should only be used with a waiting key')
    }
    const waiting = this.props.storeWaiting || this.state.localWaiting
    const {onlyDisable, storeWaiting, waitingKey, ...buttonProps} = this.props
    return (
      <Button
        {...buttonProps}
        onClick={this._onClick}
        disabled={this.props.onlyDisable ? waiting || this.props.disabled : this.props.disabled}
        waiting={this.props.onlyDisable ? false : waiting}
      />
    )
  }
}

const mapStateToProps = (state, ownProps) => {
  const waitingKey = ownProps.waitingKey || ''
  return {
    storeWaiting: WaitingConstants.anyWaiting(state, waitingKey),
  }
}

const ConnectedWaitingButton = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d}),
  'WaitingButton'
)(WaitingButton)
export default ConnectedWaitingButton
