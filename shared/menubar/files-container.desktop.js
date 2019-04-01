// @flow
import * as FsTypes from '../constants/types/fs'
import * as Constants from '../constants/fs'
import * as FsGen from '../actions/fs-gen'
import * as ProfileGen from '../actions/profile-gen'
import * as FsUtil from '../util/kbfs'
import * as TimestampUtil from '../util/timestamp'
import {type RemoteTlfUpdates} from '../fs/remote-container'
import {FilesPreview} from './files.desktop'
import {remoteConnect, setDisplayName} from '../util/container'

type State = {|
  username: string,
  fileRows: Array<RemoteTlfUpdates>,
|}

const mapStateToProps = (state: State) => ({
  _userTlfUpdates: state.fileRows,
  username: state.username,
})

const mapDispatchToProps = dispatch => ({
  _onClickAvatar: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  _onSelectPath: (path: FsTypes.Path, type: FsTypes.PathType) =>
    dispatch(FsGen.createOpenFilesFromWidget({path, type})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  userTlfUpdates: stateProps._userTlfUpdates.map(c => {
    const tlf = FsTypes.pathToString(c.tlf)
    const {participants, teamname} = FsUtil.tlfToParticipantsOrTeamname(tlf)
    const tlfType = FsTypes.getPathVisibility(c.tlf) || 'private'
    return {
      onClickAvatar: () => dispatchProps._onClickAvatar(c.writer),
      onSelectPath: () => dispatchProps._onSelectPath(c.tlf, 'folder'),
      participants: participants || [],
      path: c.tlf,
      teamname: teamname || '',
      timestamp: TimestampUtil.formatTimeForConversationList(c.timestamp),
      tlf,
      // Default to private visibility--this should never happen though.
      tlfType,
      updates: c.updates.map(({path, uploading}) => {
        const [targetNameWithoutExtension, targetExtension] = Constants.splitFileNameAndExtension(
          FsTypes.getPathName(path)
        )
        return {
          onClick: () => dispatchProps._onSelectPath(path, 'file'),
          path,
          targetExtension,
          targetNameWithoutExtension,
          tlfType,
          uploading,
        }
      }),
      username: stateProps.username,
      writer: c.writer,
    }
  }),
})

export default remoteConnect<{||}, State, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps)(
  setDisplayName('FilesPreview')(FilesPreview)
)
