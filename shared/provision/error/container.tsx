import RenderError from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect} from '../../util/container'
import openURL from '../../util/open-url'

type OwnProps = {}

export default connect(
  state => ({error: state.provision.finalError}),
  dispatch => ({
    onAccountReset: () => openURL('https://keybase.io/#account-reset'),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onKBHome: () => openURL('https://keybase.io/'),
    onPasswordReset: () => openURL('https://keybase.io/#password-reset'),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(RenderError)
