import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Constants from '../../../../../constants/teams'
import RetentionWarning from '.'
import {useConfirm} from '../use-confirm'

type OwnProps = Container.RouteProps<'retentionWarning'>

export default (ownProps: OwnProps) => {
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }

  const entityType = ownProps.route.params?.entityType ?? 'adhoc'
  const policy = ownProps.route.params?.policy ?? Constants.retentionPolicies.policyInherit

  const updateConfirm = useConfirm(state => state.updateConfirm)
  const onConfirm = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    updateConfirm(policy)
  }
  const props = {
    ...ownProps,
    entityType,
    exploding: policy.type === 'explode',
    onBack,
    onConfirm,
    timePeriod: policy.title,
  }
  return <RetentionWarning {...props} />
}
