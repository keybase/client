import {useProfileState} from '@/stores/profile'
import * as R from '@/constants/remote'
import * as T from '@/constants/types'
import * as RemoteGen from '../actions/remote-gen'
import * as FsUtil from '@/util/kbfs'
import * as TimestampUtil from '@/util/timestamp'
import {FilesPreview} from './files.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import {useCurrentUserState} from '@/stores/current-user'

const FilesContainer = (p: Pick<DeserializeProps, 'remoteTlfUpdates'>) => {
  const {remoteTlfUpdates} = p
  const username = useCurrentUserState(s => s.username)
  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  return (
    <FilesPreview
      userTlfUpdates={remoteTlfUpdates.map(c => {
        const tlf = T.FS.pathToString(c.tlf)
        const {participants, teamname} = FsUtil.tlfToParticipantsOrTeamname(tlf)
        const tlfType = T.FS.getPathVisibility(c.tlf) || T.FS.TlfType.Private
        return {
          onClickAvatar: () => showUserProfile(c.writer),
          onSelectPath: () => c.tlf && R.remoteDispatch(RemoteGen.createOpenFilesFromWidget({path: c.tlf})),
          participants: participants || [],
          path: c.tlf,
          teamname: teamname || '',
          timestamp: TimestampUtil.formatTimeForConversationList(c.timestamp),
          tlf,
          // Default to private visibility--this should never happen though.
          tlfType,
          updates: c.updates.map(({path, uploading}) => {
            return {
              onClick: () => path && R.remoteDispatch(RemoteGen.createOpenFilesFromWidget({path})),
              path,
              tlfType,
              uploading,
            }
          }),
          username,
          writer: c.writer,
        }
      })}
    />
  )
}
export default FilesContainer
