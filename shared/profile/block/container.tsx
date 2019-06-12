import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import Block from '.'
import * as Constants from '../../constants/profile'
import * as Waiting from '../../constants/waiting'
import {connect, getRouteProps, RouteProps} from '../../util/container'
import {PlatformsExpandedType} from '../../constants/types/more'
import {SiteIconSet} from '../../constants/types/tracker2'

type OwnProps = RouteProps< {username: string}, {} >

const mapStateToProps = (state, ownProps) => {
  return {
    errorMessage: state.profile.blockUserModal && state.profile.blockUserModal.error,
    idle: state.profile.blockUserModal === null,
    isWaiting: Waiting.anyWaiting(state, Constants.blockUserWaitingKey),
    username: getRouteProps(ownProps, 'username'),
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  onClose: () => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(ProfileGen.createFinishBlockUser()) // clear error
  },
  onSubmit: () => {
    const username = getRouteProps(ownProps, 'username')
    dispatch(ProfileGen.createSubmitBlockUser({username}))
  },
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d) => ({...s, ...d})
)(Block)
