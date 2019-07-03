import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import RetentionWarning from '.'
import {RetentionEntityType} from '..'
import {RetentionPolicy} from '../../../../../constants/types/retention-policy'
import {TypedState} from '../../../../../constants/reducer'

type OwnProps = Container.RouteProps<
  {
    policy: RetentionPolicy
    entityType: RetentionEntityType
    onCancel: (() => void) | null
    onConfirm: (() => void) | null
  },
  {}
>

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const policy = Container.getRouteProps(ownProps, 'policy')
  return {
    entityType: Container.getRouteProps(ownProps, 'entityType'),
    exploding: policy.type === 'explode',
    timePeriod: policy.title,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => {
  return {
    onBack: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      const onCancel: () => void | null = Container.getRouteProps(ownProps, 'onCancel')
      onCancel && onCancel()
    },
    onConfirm: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      const cb: () => void | null = Container.getRouteProps(ownProps, 'onConfirm')
      cb && cb()
    },
  }
}

const connected = Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))
// eslint-disable-next-line func-call-spacing
const withState = Container.withStateHandlers<
  {enabled: boolean},
  {setEnabled: (enabled: boolean) => {enabled: boolean} | undefined},
  {}
>({enabled: false}, {setEnabled: () => (enabled: boolean) => ({enabled})})

export default connected(withState(RetentionWarning))
