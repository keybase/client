import * as GitGen from '../../../../actions/git-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import Git from '.'
import * as Container from '../../../../util/container'
import * as FsTypes from '../../../../constants/types/fs'
import * as FsConstants from '../../../../constants/fs'

type OwnProps = {
  message: Types.MessageSystemGitPush
}

const getAutogitPath = (commitHash: string, ownProps: OwnProps): FsTypes.Path =>
  FsTypes.stringToPath(
    '/keybase/team/' +
      ownProps.message.team +
      '/.kbfs_autogit/' +
      ownProps.message.repo +
      '/.kbfs_autogit_commit_' +
      commitHash
  )

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  onClickCommit: (commitHash: string) =>
    dispatch(FsConstants.makeActionForOpenPathInFilesTab(getAutogitPath(commitHash, ownProps))),
  onClickUserAvatar: (username: string) =>
    Container.isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
  onViewGitRepo: (repoID: string, teamname: string) => {
    dispatch(GitGen.createNavigateToTeamRepo({repoID, teamname}))
  },
})

export default Container.connect(() => ({}), mapDispatchToProps, (s, d, o: OwnProps) => ({...o, ...s, ...d}))(
  Git
)
