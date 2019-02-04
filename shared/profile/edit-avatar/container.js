// @flow
import EditAvatar from '.'
import * as ProfileGen from '../../actions/profile-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {connect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import type {RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<
  {
    createdTeam: boolean,
    image: any,
    sendChatNotification: boolean,
    teamname: string,
  },
  {}
>

const mapStateToProps = (state, ownProps) => ({
  createdTeam: ownProps.routeProps.get('createdTeam'),
  image: ownProps.routeProps.get('image'),
  sendChatNotification: ownProps.routeProps.get('sendChatNotification') || false,
  teamname: ownProps.routeProps.get('teamname'),
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSaveTeamAvatar: (
    filename: string,
    teamname: string,
    sendChatNotification,
    crop?: RPCTypes.ImageCropRect
  ) => dispatch(TeamsGen.createUploadTeamAvatar({crop, filename, sendChatNotification, teamname})),
  onSaveUserAvatar: (filename: string, crop?: RPCTypes.ImageCropRect) =>
    dispatch(ProfileGen.createUploadAvatar({crop, filename})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
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

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(EditAvatar)
