import * as C from '../../../../../constants'
import type {RetentionPolicy} from '../../../../../constants/types/retention-policy'
import type {RetentionEntityType} from '../../../../team/settings-tab/retention'
import RetentionWarning from '.'
import {useConfirm} from '../use-confirm'

type OwnProps = {
  policy: RetentionPolicy
  entityType: RetentionEntityType
}

export default (ownProps: OwnProps) => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }

  const entityType = ownProps.entityType
  const policy = ownProps.policy

  const updateConfirm = useConfirm(s => s.dispatch.updateConfirm)
  const onConfirm = () => {
    navigateUp()
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
