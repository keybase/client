import * as Container from '../util/container'
import * as ConfigConstants from '../constants/config'
import * as ProfileConstants from '../constants/profile'
import * as FsTypes from '../constants/types/fs'
import * as RemoteGen from '../actions/remote-gen'
import * as FsUtil from '../util/kbfs'
import * as TimestampUtil from '../util/timestamp'
import {FilesPreview} from './files.desktop'
import type {DeserializeProps} from '../menubar/remote-serializer.desktop'

const FilesContainer = () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const {remoteTlfUpdates} = state
  const username = ConfigConstants.useCurrentUserState(s => s.username)
  const dispatch = Container.useDispatch()
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
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
                onClickAvatar: () => showUserProfile(c.writer),
                onSelectPath: () => c.tlf && dispatch(RemoteGen.createOpenFilesFromWidget({path: c.tlf})),
                participants: participants || [],
                path: c.tlf,
                teamname: teamname || '',
                timestamp: TimestampUtil.formatTimeForConversationList(c.timestamp),
                tlf,
                // Default to private visibility--this should never happen though.
                tlfType,
                updates: c.updates.map(({path, uploading}) => {
                  return {
                    onClick: () => path && dispatch(RemoteGen.createOpenFilesFromWidget({path})),
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
