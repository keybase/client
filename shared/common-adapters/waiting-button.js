// @flow
import * as React from 'react'
import Button, {type Props as ButtonProps} from './button'
import {compose, connect, setDisplayName, withStateHandlers, type TypedState} from '../util/container'

export type WaitingButtonProps = {
  localWaiting: boolean,
  onSetWaiting: (waiting: boolean) => void,
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

class WaitingButton extends React.PureComponent<ButtonProps & WaitingButtonProps> {
  _onClick = (event: SyntheticEvent<>) => {
    if (!this.props.waitingKey) {
      this.props.onSetWaiting(true)
    }
    this.props.onClick && this.props.onClick(event)
  }

  render() {
    return (
      <Button
        {...this.props}
        onClick={this._onClick}
        waiting={this.props.storeWaiting || this.props.localWaiting}
      />
    )
  }
}

const mapStateToProps = (state: TypedState, ownProps) => {
  const waitingKey = ownProps.waitingKey || ''
  return {
    storeWaiting: state.waiting.get(waitingKey, 0) !== 0,
  }
}

export const ConnectedWaitingButton = compose(
  connect(mapStateToProps),
  setDisplayName('WaitingButton'),
  withStateHandlers(({localWaiting: boolean}) => ({localWaiting: false}), {
    onSetWaiting: () => (localWaiting: boolean) => ({localWaiting}),
  })
)(WaitingButton)

export default ConnectedWaitingButton
