import * as C from '../../../../constants'
import * as Container from '../../../../util/container'
import * as React from 'react'
import Git from '.'
import * as T from '../../../../constants/types'

type OwnProps = {
  message: T.Chat.MessageSystemGitPush
}

const GitContainer = React.memo(function GitContainer(p: OwnProps) {
  const {message} = p
  const onClickCommit = React.useCallback(
    (commitHash: string) => {
      const path = T.FS.stringToPath(
        '/keybase/team/' +
          message.team +
          '/.kbfs_autogit/' +
          message.repo +
          '/.kbfs_autogit_commit_' +
          commitHash
      )
      C.makeActionForOpenPathInFilesTab(path)
    },
    [message]
  )
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const onClickUserAvatar = React.useCallback(
    (username: string) => {
      Container.isMobile ? showUserProfile(username) : showUser(username, true)
    },
    [showUser, showUserProfile]
  )
  const navigateToTeamRepo = C.useGitState(s => s.dispatch.navigateToTeamRepo)
  const onViewGitRepo = React.useCallback(
    (repoID: string, teamname: string) => {
      navigateToTeamRepo(teamname, repoID)
    },
    [navigateToTeamRepo]
  )
  const props = {message, onClickCommit, onClickUserAvatar, onViewGitRepo}
  return <Git {...props} />
})

export default GitContainer
