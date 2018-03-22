// @flow
import {connect, compose, withStateHandlers, type TypedState} from '../../../../../util/container'
import RetentionWarning from '.'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  return {
    days: routeProps.get('days'),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeProps, navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  // TODO maybe take some more identifiers {teamname, conversationIDKey} and handle it here
  // when you're not decreasing the policy this warning doesn't show so the parent component
  // needs to know how to make the calls anyway
  onConfirm: () => {
    const cb: () => void = routeProps.get('onConfirm')
    cb && cb()
    dispatch(navigateUp())
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withStateHandlers({enabled: false}, {setEnabled: () => (enabled: boolean) => ({enabled})})
)(RetentionWarning)
