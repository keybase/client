// @flow
import {connect, compose, withStateHandlers, type TypedState} from '../../../../../util/container'
import RetentionWarning from '.'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  return {
    days: routeProps.get('days'),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeProps, navigateUp}) => {
  const onBack = () => dispatch(navigateUp())
  return {
    onBack,
    onCancel: () => {
      onBack()
      const onCancel: ?() => void = routeProps.get('onCancel')
      onCancel && onCancel()
    },
    onConfirm: () => {
      onBack()
      const cb: ?() => void = routeProps.get('onConfirm')
      cb && cb()
    },
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withStateHandlers({enabled: false}, {setEnabled: () => (enabled: boolean) => ({enabled})})
)(RetentionWarning)
