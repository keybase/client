// @flow
import {remoteConnect, compose, renderNothing, branch} from '../util/container'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as PinentryGen from '../actions/pinentry-gen'
import Pinentry from './index.desktop'

type OwnProps = {||}
type State = {|
  showTyping: RPCTypes.Feature,
  type: RPCTypes.PassphraseType,
  prompt: string,
  retryLabel?: string,
  submitLabel?: string,
  sessionID: number,
|}

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = dispatch => ({
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
  remoteConnect<OwnProps, State, _, _, _, _>(state => state, mapDispatchToProps, mergeProps),
  branch(props => !props.type, renderNothing)
)(Pinentry)
