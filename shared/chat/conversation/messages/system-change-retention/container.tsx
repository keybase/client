import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as TeamsConstants from '../../../../constants/teams'
import * as ConfigConstants from '../../../../constants/config'
import * as ProfileConstants from '../../../../constants/profile'
import * as Container from '../../../../util/container'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import type * as Types from '../../../../constants/types/chat2'
import SystemChangeRetention from '.'
import {getCanPerform} from '../../../../constants/teams'

type OwnProps = {
  message: Types.MessageSystemChangeRetention
}

const SystemChangeRetentionContainer = React.memo(function SystemChangeRetentionContainer(p: OwnProps) {
  const {message} = p
  const {conversationIDKey, isInherit, isTeam, membersType, policy, timestamp, user} = message

  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const canManage = TeamsConstants.useState(s =>
    meta.teamType === 'adhoc' ? true : getCanPerform(s, meta.teamname).setRetentionPolicy
  )

  const dispatch = Container.useDispatch()
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const onClickUserAvatar = React.useCallback(() => {
    Container.isMobile
      ? showUserProfile(user)
      : dispatch(Tracker2Gen.createShowUser({asTracker: true, username: user}))
  }, [showUserProfile, dispatch, user])
  const onManageRetention = React.useCallback(() => {
    dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true, tab: 'settings'}))
  }, [dispatch, conversationIDKey])
  const props = {
    canManage,
    isInherit,
    isTeam,
    membersType,
    onClickUserAvatar,
    onManageRetention,
    policy,
    timestamp,
    user,
    you,
  }

  return <SystemChangeRetention {...props} />
})
export default SystemChangeRetentionContainer
