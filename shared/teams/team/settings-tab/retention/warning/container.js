// @flow
import {connect, compose, withStateHandlers, type TypedState} from '../../../../../util/container'
import RetentionWarning from '.'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  return {
    days: routeProps.get('days'),
    entityType: routeProps.get('entityType'),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeProps, navigateUp}) => {
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
  connect(
    mapStateToProps,
    mapDispatchToProps
  ),
  withStateHandlers({enabled: false}, {setEnabled: () => (enabled: boolean) => ({enabled})})
)(RetentionWarning)
