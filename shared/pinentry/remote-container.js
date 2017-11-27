// @flow
import {connect, compose, renderNothing, branch, type Dispatch} from '../util/container'
import {createOnCancel, createOnSubmit} from '../actions/pinentry-gen'
import Pinentry from '.'

// Props are handled by remote-pinentry.desktop.js
const mapStateToProps = state => state
const mapDispatchToprops = (dispatch: Dispatch) => ({
  _onCancel: (sessionID: string) => dispatch(createOnCancel({sessionID})),
  _onSubmit: (passphrase: string, features: {[key: string]: boolean}, sessionID: string) =>
    dispatch(createOnSubmit({features, passphrase, sessionID})),
})
const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps): Props => ({
  ...stateProps,
  ...dispatchProps,
  onCancel: () => dispatchProps._onCancel(stateProps.sessionID),
  onSubmit: (passphrase: string, features: {[key: string]: boolean}) =>
    dispatchProps._onSubmit(passphrase, features, stateProps.sessionID),
  ...ownProps,
})
export default compose(
  connect(mapStateToProps, mapDispatchToprops, mergeProps),
  branch(props => !props.features, renderNothing)
)(Pinentry)
