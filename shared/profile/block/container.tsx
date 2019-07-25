import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import Block from '.'
import * as Constants from '../../constants/profile'
import * as Waiting from '../../constants/waiting'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<{username: string}>

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    errorMessage:
      (state.profile.blockUserModal &&
        state.profile.blockUserModal !== 'waiting' &&
        state.profile.blockUserModal.error) ||
      undefined,
    idle: state.profile.blockUserModal === null,
    isWaiting: Waiting.anyWaiting(state, Constants.blockUserWaitingKey),
    username: Container.getRouteProps(ownProps, 'username', ''),
  }),
  (dispatch, ownProps: OwnProps) => ({
    onClose: () => {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(ProfileGen.createFinishBlockUser()) // clear error
    },
    onSubmit: () => {
      const username = Container.getRouteProps(ownProps, 'username', '')
      dispatch(ProfileGen.createSubmitBlockUser({username}))
    },
  }),
  (s, d, _: OwnProps) => ({...s, ...d})
)(Block)
