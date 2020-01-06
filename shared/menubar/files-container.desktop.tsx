import * as FsTypes from '../constants/types/fs'
import * as FsGen from '../actions/fs-gen'
import * as ProfileGen from '../actions/profile-gen'
import * as FsUtil from '../util/kbfs'
import * as TimestampUtil from '../util/timestamp'
import {FilesPreview} from './files.desktop'
import {remoteConnect} from '../util/container'
import {DeserializeProps} from '../menubar/remote-serializer.desktop'

export default remoteConnect(
  (state: DeserializeProps) => ({
    _userTlfUpdates: state.remoteTlfUpdates,
    username: state.config.username,
  }),
  dispatch => ({
    _onClickAvatar: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
    _onSelectPath: (path: FsTypes.Path, type: FsTypes.PathType) =>
      dispatch(FsGen.createOpenFilesFromWidget({path, type})),
  }),
  (stateProps, dispatchProps, _ownProps: {}) => ({
    userTlfUpdates: __STORYBOOK__
      ? []
      : stateProps._userTlfUpdates.map(c => {
          const tlf = FsTypes.pathToString(c.tlf)
          const {participants, teamname} = FsUtil.tlfToParticipantsOrTeamname(tlf)
          const tlfType = FsTypes.getPathVisibility(c.tlf) || FsTypes.TlfType.Private
          return {
            onClickAvatar: () => dispatchProps._onClickAvatar(c.writer),
            onSelectPath: () => dispatchProps._onSelectPath(c.tlf, FsTypes.PathType.Folder),
            participants: participants || [],
            path: c.tlf,
            teamname: teamname || '',
            timestamp: TimestampUtil.formatTimeForConversationList(c.timestamp),
            tlf,
            // Default to private visibility--this should never happen though.
            tlfType,
            updates: c.updates.map(({path, uploading}) => {
              return {
                onClick: () => dispatchProps._onSelectPath(path, FsTypes.PathType.File),
                path,
                tlfType,
                uploading,
              }
            }),
            username: stateProps.username,
            writer: c.writer,
          }
        }),
  })
)(FilesPreview)
