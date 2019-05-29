import RenderError from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect} from '../../util/container'
import {RouteProps} from '../../route-tree/render-route'
import openURL from '../../util/open-url'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  error: state.provision.finalError,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onAccountReset: () => openURL('https://keybase.io/#account-reset'),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onKBHome: () => openURL('https://keybase.io/'),
  onPasswordReset: () => openURL('https://keybase.io/#password-reset'),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(RenderError)
