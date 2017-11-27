// @flow
import {connect, compose, renderNothing, branch, type Dispatch} from '../util/container'
import {createOnCancel, createOnSubmit} from '../actions/pinentry-gen'
import Pinentry from './index.desktop'

// Props are handled by remote-pinentry.desktop.js
const mapStateToProps = state => state
const mapDispatchToprops = (dispatch: Dispatch) => ({
  _onCancel: (sessionID: number) => dispatch(createOnCancel({sessionID})),
  _onSubmit: (passphrase: string, sessionID: number) => dispatch(createOnSubmit({passphrase, sessionID})),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  onCancel: () => dispatchProps._onCancel(stateProps.sessionID),
  onSubmit: (passphrase: string) => dispatchProps._onSubmit(passphrase, stateProps.sessionID),
  ...ownProps,
})
export default compose(
  connect(mapStateToProps, mapDispatchToprops, mergeProps),
  branch(props => !props.type, renderNothing)
)(Pinentry)
