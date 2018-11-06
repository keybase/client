// @flow
import * as GitGen from '../../../../actions/git-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as TrackerGen from '../../../../actions/tracker-gen'
import Git from '.'
import {connect, isMobile} from '../../../../util/container'

const mapDispatchToProps = (dispatch) => ({
  onClickUserAvatar: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  onViewGitRepo: (repoID: string, teamname: string) => {
    dispatch(GitGen.createNavigateToTeamRepo({repoID, teamname}))
  },
})

export default connect<OwnProps, _,_,_,_>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Git)
