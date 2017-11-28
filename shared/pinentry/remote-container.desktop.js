// @flow
import {connect, compose, renderNothing, branch, type Dispatch} from '../util/container'
import * as PinentryGen from '../actions/pinentry-gen'
import Pinentry from './index.desktop'

// Props are handled by remote-pinentry.desktop.js
const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onCancel: (sessionID: number) => dispatch(PinentryGen.createOnCancel({sessionID})),
  _onSubmit: (passphrase: string, sessionID: number) =>
    dispatch(PinentryGen.createOnSubmit({passphrase, sessionID})),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  onCancel: () => dispatchProps._onCancel(stateProps.sessionID),
  onSubmit: (passphrase: string) => dispatchProps._onSubmit(passphrase, stateProps.sessionID),
  ...ownProps,
})
export default compose(
  connect(state => state, mapDispatchToProps, mergeProps),
  branch(props => !props.type, renderNothing)
)(Pinentry)
