import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as ProfileGen from '../../../../actions/profile-gen'
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

  const you = Container.useSelector(state => state.config.username)
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const canManage = Container.useSelector(state =>
    meta.teamType === 'adhoc' ? true : getCanPerform(state, meta.teamname).setRetentionPolicy
  )

  const dispatch = Container.useDispatch()
  const onClickUserAvatar = React.useCallback(() => {
    Container.isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username: user}))
      : dispatch(Tracker2Gen.createShowUser({asTracker: true, username: user}))
  }, [dispatch, user])
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
