import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import RetentionWarning from '.'
import {RetentionEntityType} from '..'
import {RetentionPolicy} from '../../../../../constants/types/retention-policy'
import * as Constants from '../../../../../constants/teams'
import {TypedState} from '../../../../../constants/reducer'

type OwnProps = Container.RouteProps<{
  policy: RetentionPolicy
  entityType: RetentionEntityType
  onCancel: (() => void) | null
  onConfirm: (() => void) | null
}>

const connected = Container.connect(
  (_: TypedState, ownProps: OwnProps) => {
    const policy = Container.getRouteProps(ownProps, 'policy', Constants.retentionPolicies.policyInherit)
    return {
      entityType: Container.getRouteProps(ownProps, 'entityType', 'adhoc'),
      exploding: policy.type === 'explode',
      timePeriod: policy.title,
    }
  },
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
  (s, d, o) => ({...o, ...s, ...d})
)

// eslint-disable-next-line func-call-spacing
const withState = Container.withStateHandlers<
  {enabled: boolean},
  {setEnabled: (enabled: boolean) => {enabled: boolean} | undefined},
  {}
>({enabled: false}, {setEnabled: () => (enabled: boolean) => ({enabled})})

// @ts-ignore
export default connected(withState(RetentionWarning)) as any
