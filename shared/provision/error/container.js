// @flow
import RenderError from '.'
import {connect} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'
import openURL from '../../util/open-url'
import flags from '../../util/feature-flags'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  error: state.provision.finalError,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onAccountReset: () => openURL('https://keybase.io/#account-reset'),
  onBack: () => {
    !flags.useNewRouter && dispatch(ownProps.navigateUp())
  },
  onKBHome: () => openURL('https://keybase.io/'),
  onPasswordReset: () => openURL('https://keybase.io/#password-reset'),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(RenderError)
