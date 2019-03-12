// @flow
import {HeaderOrPopup} from '../../common-adapters'
import {connect, compose, type RouteProps} from '../../util/container'
import LogOut from '.'

type OwnProps = RouteProps<{teamname: string, selected: boolean, repoID: string}, {}>

const mapStateToProps = (state, {routeProps}) => ({
  hasRandomPW: true, //, state.settings.passphrase.randomPW,
})

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  onCancel: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  ...stateProps,
  ...dispatchProps,
  heading: stateProps.hasRandomPW
    ? "You don't have a passphrase set -- you should set one before logging out, so that you can log in again later."
    : 'Would you like to make sure that you know your passphrase before logging out?',
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(HeaderOrPopup(LogOut))
