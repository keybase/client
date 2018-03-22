// @flow
import {connect, compose, withStateHandlers} from '../../../../../util/container'
import RetentionWarning from '.'

const mapDispatchToProps = (dispatch: Dispatch, {routeProps, navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  // TODO maybe take some more identifiers {teamname, conversationIDKey} and handle it here
  // when you're not decreasing the policy this warning doesn't show so the parent component
  // needs to know how to make the calls anyway
  onConfirm: routeProps.get('onConfirm'),
})

export default compose(
  connect(undefined, mapDispatchToProps),
  withStateHandlers({enabled: false}, {setEnabled: () => (enabled: boolean) => ({enabled})})
)(RetentionWarning)
