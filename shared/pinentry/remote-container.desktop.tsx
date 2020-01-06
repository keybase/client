import * as Container from '../util/container'
import * as PinentryGen from '../actions/pinentry-gen'
import Pinentry from './index.desktop'
import {DeserializeProps} from './remote-serializer.desktop'

type OwnProps = {}

// Props are handled by remote-proxy.desktop.js
export default Container.remoteConnect(
  (state: DeserializeProps) => state,
  dispatch => ({
    onCancel: () => dispatch(PinentryGen.createOnCancel()),
    onSubmit: (password: string) => dispatch(PinentryGen.createOnSubmit({password})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
  })
)(Pinentry)
