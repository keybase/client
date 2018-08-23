// @flow
import EditAvatar, {type Props} from '.'
import * as ProfileGen from '../../actions/profile-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {connect, type TypedState} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'
import type {RouteProps} from '../../route-tree/render-route'

const mapStateToProps = (
  state: TypedState,
  {
    routeProps,
  }: RouteProps<{createdTeam: boolean, image: any, sendChatNotification: boolean, teamname: string}, {}>
) => ({
  createdTeam: routeProps.get('createdTeam'),
  image: routeProps.get('image'),
  sendChatNotification: routeProps.get('sendChatNotification') || false,
  teamname: routeProps.get('teamname'),
})

const mapDispatchToProps = (dispatch, ownProps: Props) => ({
  onClose: () => dispatch(navigateUp()),
  onSaveTeamAvatar: (
    filename: string,
    teamname: string,
    sendChatNotification,
    crop?: RPCTypes.ImageCropRect
  ) => dispatch(TeamsGen.createUploadTeamAvatar({crop, filename, sendChatNotification, teamname})),
  onSaveUserAvatar: (filename: string, crop?: RPCTypes.ImageCropRect) =>
    dispatch(ProfileGen.createUploadAvatar({crop, filename})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: Props) => ({
  createdTeam: stateProps.createdTeam,
  image: stateProps.image,
  onClose: dispatchProps.onClose,
  onSave: (filename: string, crop?: RPCTypes.ImageCropRect) =>
    stateProps.teamname
      ? dispatchProps.onSaveTeamAvatar(filename, stateProps.teamname, stateProps.sendChatNotification, crop)
      : dispatchProps.onSaveUserAvatar(filename, crop),
  sendChatNotification: stateProps.sendChatNotification,
  teamname: stateProps.teamname,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(EditAvatar)
