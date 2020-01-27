import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import * as Types from '../../../../constants/types/chat2'
import SystemChangeRetention from '.'
import {getCanPerform} from '../../../../constants/teams'

type OwnProps = {
  message: Types.MessageSystemChangeRetention
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const meta = Constants.getMeta(state, ownProps.message.conversationIDKey)
    let canManage = false
    if (meta.teamType === 'adhoc') {
      canManage = true
    } else {
      canManage = getCanPerform(state, meta.teamname).setRetentionPolicy
    }
    return {
      canManage: canManage,
      isInherit: ownProps.message.isInherit,
      isTeam: ownProps.message.isTeam,
      membersType: ownProps.message.membersType,
      policy: ownProps.message.policy,
      timestamp: ownProps.message.timestamp,
      user: ownProps.message.user,
      you: state.config.username,
    }
  },
  dispatch => ({
    _onClickUserAvatar: (username: string) => {
      Container.isMobile
        ? dispatch(ProfileGen.createShowUserProfile({username}))
        : dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
    },
    _onManageRetention: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(
        Chat2Gen.createShowInfoPanel({
          conversationIDKey,
          show: true,
          tab: 'settings',
        })
      ),
  }),
  (stateProps, dispatchProps, ownProps) => ({
    canManage: stateProps.canManage,
    isInherit: stateProps.isInherit,
    isTeam: stateProps.isTeam,
    membersType: stateProps.membersType,
    onClickUserAvatar: () => dispatchProps._onClickUserAvatar(ownProps.message.user),
    onManageRetention: () => dispatchProps._onManageRetention(ownProps.message.conversationIDKey),
    policy: stateProps.policy,
    timestamp: stateProps.timestamp,
    user: stateProps.user,
    you: stateProps.you,
  })
)(SystemChangeRetention)
