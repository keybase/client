// @flow
import * as React from 'react'
import Button, {type Props as ButtonProps} from './button'
import {compose, connect, withStateHandlers, type TypedState} from '../util/container'

export type WaitingButtonProps = {
  localWaiting: boolean,
  onSetWaiting: (waiting: boolean) => void,
  storeWaiting: boolean,
  waitingKey: ?string,
}

class UnconnectedWaitingButton extends React.PureComponent<ButtonProps & WaitingButtonProps> {
  _onClick = (event: SyntheticEvent<>) => {
    if (!this.props.waitingKey) {
      console.warn('calling onSetWaiting')
      this.props.onSetWaiting(true)
    }
    this.props.onClick && this.props.onClick(event)
  }

  render() {
    console.warn('waitingkey', this.props.waitingKey, this.props.storeWaiting, this.props.localWaiting)
    return <Button {...this.props} onClick={this._onClick} waiting={this.props.storeWaiting || this.props.localWaiting} />
  }
}

const mapStateToProps = (state: TypedState, ownProps) => {
  const waitingKey = ownProps.waitingKey || ''
  return {
    storeWaiting: state.waiting.get(waitingKey, 0) !== 0,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({

})

export const WaitingButton = compose(
  connect(mapStateToProps, mapDispatchToProps),
  withStateHandlers(({localWaiting: boolean}) => ({localWaiting: false}), {
    onSetWaiting: () => (localWaiting: boolean) => ({localWaiting}),
  }),
)(UnconnectedWaitingButton)

export default WaitingButton
