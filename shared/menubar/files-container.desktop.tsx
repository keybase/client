import * as Container from '../util/container'
import * as FsTypes from '../constants/types/fs'
import * as FsGen from '../actions/fs-gen'
import * as ProfileGen from '../actions/profile-gen'
import * as FsUtil from '../util/kbfs'
import * as TimestampUtil from '../util/timestamp'
import {FilesPreview} from './files.desktop'
import type {DeserializeProps} from '../menubar/remote-serializer.desktop'

const FilesContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const {remoteTlfUpdates, config} = state
  const {username} = config
  const dispatch = Container.useDispatch()
  return (
    <FilesPreview
      userTlfUpdates={
        __STORYBOOK__
          ? []
          : remoteTlfUpdates.map(c => {
              const tlf = FsTypes.pathToString(c.tlf)
              const {participants, teamname} = FsUtil.tlfToParticipantsOrTeamname(tlf)
              const tlfType = FsTypes.getPathVisibility(c.tlf) || FsTypes.TlfType.Private
              return {
                onClickAvatar: () => dispatch(ProfileGen.createShowUserProfile({username: c.writer})),
                onSelectPath: () =>
                  dispatch(FsGen.createOpenFilesFromWidget({path: c.tlf, type: FsTypes.PathType.Folder})),
                participants: participants || [],
                path: c.tlf,
                teamname: teamname || '',
                timestamp: TimestampUtil.formatTimeForConversationList(c.timestamp),
                tlf,
                // Default to private visibility--this should never happen though.
                tlfType,
                updates: c.updates.map(({path, uploading}) => {
                  return {
                    onClick: () =>
                      dispatch(FsGen.createOpenFilesFromWidget({path, type: FsTypes.PathType.File})),
                    path,
                    tlfType,
                    uploading,
                  }
                }),
                username,
                writer: c.writer,
              }
            })
      }
    />
  )
}
export default FilesContainer
