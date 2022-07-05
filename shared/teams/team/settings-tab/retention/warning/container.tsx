import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import RetentionWarning from '.'
import {RetentionEntityType} from '..'
import {RetentionPolicy} from '../../../../../constants/types/retention-policy'
import * as Constants from '../../../../../constants/teams'

type OwnProps = Container.RouteProps<{
  policy: RetentionPolicy
  entityType: RetentionEntityType
  onCancel: (() => void) | null
  onConfirm: (() => void) | null
}>

export default Container.connect(
  () => ({}),
  (dispatch, ownProps: OwnProps) => ({
    onBack: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      const onCancel: (() => void) | null = Container.getRouteProps(ownProps, 'onCancel', null)
      onCancel && onCancel()
    },
    onConfirm: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      const cb: (() => void) | null = Container.getRouteProps(ownProps, 'onConfirm', null)
      cb && cb()
    },
  }),
  (_s, d, ownProps: OwnProps) => {
    const policy = Container.getRouteProps(ownProps, 'policy', Constants.retentionPolicies.policyInherit)
    return {
      ...ownProps,
      ...d,
      entityType: Container.getRouteProps(ownProps, 'entityType', 'adhoc'),
      exploding: policy.type === 'explode',
      timePeriod: policy.title,
    }
  }
)(RetentionWarning)
