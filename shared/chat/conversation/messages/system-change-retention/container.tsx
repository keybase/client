import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import SystemChangeRetention from '.'

type OwnProps = {
  message: T.Chat.MessageSystemChangeRetention
}

const SystemChangeRetentionContainer = React.memo(function SystemChangeRetentionContainer(p: OwnProps) {
  const {message} = p
  const {isInherit, isTeam, membersType, policy, timestamp, user} = message

  const you = C.useCurrentUserState(s => s.username)
  const meta = C.useChatContext(s => s.meta)
  const canManage = C.useTeamsState(s =>
    meta.teamType === 'adhoc' ? true : C.Teams.getCanPerform(s, meta.teamname).setRetentionPolicy
  )

  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const onClickUserAvatar = React.useCallback(() => {
    C.isMobile ? showUserProfile(user) : showUser(user, true)
  }, [showUserProfile, showUser, user])
  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const onManageRetention = React.useCallback(() => {
    showInfoPanel(true, 'settings')
  }, [showInfoPanel])
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
