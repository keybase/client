// @flow
import {connect, compose, withStateHandlers} from '../../../../../util/container'
import RetentionWarning from '.'

const mapDispatchToProps = (dispatch: Dispatch, {routeProps, navigateUp}) => ({
  onBack: () => dispatch(navigateUp),
  onConfirm: routeProps.get('onConfirm'),
})

export default compose(
  connect(undefined, mapDispatchToProps),
  withStateHandlers({enabled: false}, {setEnabled: () => (enabled: boolean) => ({enabled})})
)(RetentionWarning)
