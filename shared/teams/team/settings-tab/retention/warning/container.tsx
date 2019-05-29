import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import RetentionWarning from '.'
import {RetentionEntityType} from '..'
import {RetentionPolicy} from '../../../../../constants/types/retention-policy'

type OwnProps = Container.RouteProps<
  {
    policy: RetentionPolicy
    entityType: RetentionEntityType
    onCancel: () => void | null
    onConfirm: () => void | null
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  const policy = Container.getRouteProps(ownProps, 'policy')
  return {
    entityType: Container.getRouteProps(ownProps, 'entityType'),
    exploding: policy.type === 'explode',
    timePeriod: policy.title,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
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

export default Container.compose(
  Container.connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  Container.withStateHandlers({enabled: false}, {setEnabled: () => (enabled: boolean) => ({enabled})})
)(RetentionWarning)
