// @flow
import * as GitGen from '../../../../actions/git-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import Git from '.'
import {connect, isMobile} from '../../../../util/container'

type OwnProps = {|
  message: Types.MessageSystemGitPush,
|}

const mapDispatchToProps = dispatch => ({
  onClickUserAvatar: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
  onViewGitRepo: (repoID: string, teamname: string) => {
    dispatch(GitGen.createNavigateToTeamRepo({repoID, teamname}))
  },
})

export default connect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Git)
