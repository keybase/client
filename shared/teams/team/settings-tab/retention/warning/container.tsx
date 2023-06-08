import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import type {RetentionPolicy} from '../../../../../constants/types/retention-policy'
import type {RetentionEntityType} from '../../../../team/settings-tab/retention'
import RetentionWarning from '.'
import {useConfirm} from '../use-confirm'

type OwnProps = {
  policy: RetentionPolicy
  entityType: RetentionEntityType
}

export default (ownProps: OwnProps) => {
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }

  const entityType = ownProps.entityType
  const policy = ownProps.policy

  const updateConfirm = useConfirm(s => s.updateConfirm)
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
