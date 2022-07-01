import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Constants from '../../../../../constants/teams'
import RetentionWarning from '.'

type OwnProps = Container.RouteProps<'retentionWarning'>

export default Container.connect(
  () => ({}),
  (dispatch, ownProps: OwnProps) => ({
    onBack: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      const onCancel = ownProps.route.params?.onCancel ?? null
      onCancel?.()
    },
    onConfirm: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      const cb = ownProps.route.params?.onConfirm ?? null
      cb?.()
    },
  }),
  (_s, d, ownProps: OwnProps) => {
    const policy = ownProps.route.params?.policy ?? Constants.retentionPolicies.policyInherit
    return {
      ...ownProps,
      ...d,
      entityType: ownProps.route.params?.entityType ?? 'adhoc',
      exploding: policy.type === 'explode',
      timePeriod: policy.title,
    }
  }
)(RetentionWarning)
