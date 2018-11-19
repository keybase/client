// @flow
import {connect, compose, withStateHandlers, type RouteProps} from '../../../../../util/container'
import RetentionWarning from '.'
import type {RetentionEntityType} from '..'

type OwnProps = RouteProps<
  {days: number, entityType: RetentionEntityType, onCancel: ?() => void, onConfirm: ?() => void},
  {}
>

const mapStateToProps = (state, {routeProps}) => {
  return {
    days: routeProps.get('days'),
    entityType: routeProps.get('entityType'),
  }
}

const mapDispatchToProps = (dispatch, {routeProps, navigateUp}) => {
  return {
    onBack: () => {
      dispatch(navigateUp())
      const onCancel: ?() => void = routeProps.get('onCancel')
      onCancel && onCancel()
    },
    onConfirm: () => {
      dispatch(navigateUp())
      const cb: ?() => void = routeProps.get('onConfirm')
      cb && cb()
    },
  }
}

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withStateHandlers({enabled: false}, {setEnabled: () => (enabled: boolean) => ({enabled})})
)(RetentionWarning)
