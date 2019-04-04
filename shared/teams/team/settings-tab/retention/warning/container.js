// @flow
import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import RetentionWarning from '.'
import type {RetentionEntityType} from '..'
import type {RetentionPolicy} from '../../../../../constants/types/retention-policy'

type OwnProps = Container.RouteProps<
  {policy: RetentionPolicy, entityType: RetentionEntityType, onCancel: ?() => void, onConfirm: ?() => void},
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
      const onCancel: ?() => void = Container.getRouteProps(ownProps, 'onCancel')
      onCancel && onCancel()
    },
    onConfirm: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      const cb: ?() => void = Container.getRouteProps(ownProps, 'onConfirm')
      cb && cb()
    },
  }
}

export default Container.compose(
  Container.connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  Container.withStateHandlers({enabled: false}, {setEnabled: () => (enabled: boolean) => ({enabled})})
)(RetentionWarning)
