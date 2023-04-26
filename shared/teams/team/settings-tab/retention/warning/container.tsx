import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Constants from '../../../../../constants/teams'
import RetentionWarning from '.'

type OwnProps = Container.RouteProps<'retentionWarning'>

export default (ownProps: OwnProps) => {
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onConfirm = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    const cb = ownProps.route.params?.onConfirm ?? null
    cb?.()
  }
  const policy = ownProps.route.params?.policy ?? Constants.retentionPolicies.policyInherit
  const props = {
    ...ownProps,
    entityType: ownProps.route.params?.entityType ?? 'adhoc',
    exploding: policy.type === 'explode',
    onBack,
    onConfirm,
    timePeriod: policy.title,
  }
  return <RetentionWarning {...props} />
}
