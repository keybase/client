import RenderError from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect} from '../../util/container'
import openURL from '../../util/open-url'
import * as AutoresetGen from '../../actions/autoreset-gen'

type OwnProps = {}

const ConnectedRenderError = connect(
  state => ({
    _username: state.provision.username,
    error: state.provision.finalError,
  }),
  dispatch => ({
    _onAccountReset: (username: string) =>
      dispatch(AutoresetGen.createStartAccountReset({skipPassword: false, username})),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onKBHome: () => openURL('https://keybase.io/'),
    onPasswordReset: () => openURL('https://keybase.io/#password-reset'),
  }),
  (s, d, o: OwnProps) => ({
    ...o,
    ...s,
    ...d,
    onAccountReset: () => d._onAccountReset(s._username),
  })
)(RenderError)

export default ConnectedRenderError
