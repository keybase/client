// @flow
import RenderError from '.'
import {connect} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'
import openURL from '../../util/open-url'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  error: state.provision.finalError,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onAccountReset: () => openURL('https://keybase.io/#account-reset'),
  onBack: () => dispatch(ownProps.navigateUp()),
  onKBHome: () => openURL('https://keybase.io/'),
  onPasswordReset: () => openURL('https://keybase.io/#password-reset'),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(RenderError)
