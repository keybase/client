// @flow
import EditAvatar, {type Props} from './edit-avatar.render'
import * as ProfileGen from '../actions/profile-gen'
import * as TeamsGen from '../actions/teams-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import {connect, type TypedState} from '../util/container'
import {navigateUp} from '../actions/route-tree'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  image: routeProps.get('image'),
  sendChatNotification: routeProps.get('sendChatNotification'),
  teamname: routeProps.get('teamname'),
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: Props) => ({
  onClose: () => dispatch(navigateUp()),
  onSaveTeamAvatar: (
    filename: string,
    teamname: string,
    sendChatNotification: boolean,
    crop?: RPCTypes.ImageCropRect
  ) => dispatch(TeamsGen.createUploadTeamAvatar({crop, filename, sendChatNotification, teamname})),
  onSaveUserAvatar: (filename: string, crop?: RPCTypes.ImageCropRect) =>
    dispatch(ProfileGen.createUploadAvatar({crop, filename})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: Props) => ({
  onClose: dispatchProps.onClose,
  onSave: (filename: string, crop: RPCTypes.ImageCropRect, teamname: string, sendChatNotification: boolean) =>
    ownProps.isTeam
      ? dispatchProps.onSaveTeamAvatar(filename, teamname, sendChatNotification, crop)
      : dispatchProps.onSaveUserAvatar(filename, crop),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(EditAvatar)
