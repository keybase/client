import * as C from '../../../../constants'
import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as TrackerConstants from '../../../../constants/tracker2'
import * as TeamsConstants from '../../../../constants/teams'
import * as Container from '../../../../util/container'
import type * as Types from '../../../../constants/types/chat2'
import SystemChangeRetention from '.'
import {getCanPerform} from '../../../../constants/teams'

type OwnProps = {
  message: Types.MessageSystemChangeRetention
}

const SystemChangeRetentionContainer = React.memo(function SystemChangeRetentionContainer(p: OwnProps) {
  const {message} = p
  const {conversationIDKey, isInherit, isTeam, membersType, policy, timestamp, user} = message

  const you = C.useCurrentUserState(s => s.username)
  const meta = Constants.useContext(s => s.meta)
  const canManage = TeamsConstants.useState(s =>
    meta.teamType === 'adhoc' ? true : getCanPerform(s, meta.teamname).setRetentionPolicy
  )

  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const showUser = TrackerConstants.useState(s => s.dispatch.showUser)
  const onClickUserAvatar = React.useCallback(() => {
    Container.isMobile ? showUserProfile(user) : showUser(user, true)
  }, [showUserProfile, showUser, user])
  const showInfoPanel = Constants.useState(s => s.dispatch.showInfoPanel)
  const onManageRetention = React.useCallback(() => {
    showInfoPanel(true, 'settings', conversationIDKey)
  }, [showInfoPanel, conversationIDKey])
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
