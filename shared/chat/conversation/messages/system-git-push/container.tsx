import * as Container from '../../../../util/container'
import * as FsConstants from '../../../../constants/fs'
import * as FsTypes from '../../../../constants/types/fs'
import * as GitGen from '../../../../actions/git-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as React from 'react'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import Git from '.'
import type * as Types from '../../../../constants/types/chat2'

type OwnProps = {
  message: Types.MessageSystemGitPush
}

const GitContainer = React.memo(function GitContainer(p: OwnProps) {
  const {message} = p
  const dispatch = Container.useDispatch()
  const onClickCommit = React.useCallback(
    (commitHash: string) => {
      const path = FsTypes.stringToPath(
        '/keybase/team/' +
          message.team +
          '/.kbfs_autogit/' +
          message.repo +
          '/.kbfs_autogit_commit_' +
          commitHash
      )
      dispatch(FsConstants.makeActionForOpenPathInFilesTab(path))
    },
    [dispatch, message]
  )
  const onClickUserAvatar = React.useCallback(
    (username: string) => {
      Container.isMobile
        ? dispatch(ProfileGen.createShowUserProfile({username}))
        : dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
    },
    [dispatch]
  )
  const onViewGitRepo = React.useCallback(
    (repoID: string, teamname: string) => {
      dispatch(GitGen.createNavigateToTeamRepo({repoID, teamname}))
    },
    [dispatch]
  )
  const props = {message, onClickCommit, onClickUserAvatar, onViewGitRepo}
  return <Git {...props} />
})

export default GitContainer
