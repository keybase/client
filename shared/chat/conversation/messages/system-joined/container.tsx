import * as C from '../../../../constants'
import * as Constants from '../../../../constants/chat2'
import * as TeamsConstants from '../../../../constants/teams'
import * as React from 'react'
import Joined from '.'
import type * as Types from '../../../../constants/types/chat2'

type OwnProps = {message: Types.MessageSystemJoined}

const JoinedContainer = React.memo(function JoinedContainer(p: OwnProps) {
  const {message} = p
  const {joiners, author, conversationIDKey, leavers, timestamp} = message

  const meta = Constants.useContext(s => s.meta)
  const {channelname, teamType, teamname, teamID} = meta

  const you = C.useCurrentUserState(s => s.username)
  const authorIsYou = you === author

  const manageChatChannels = TeamsConstants.useState(s => s.dispatch.manageChatChannels)
  const onManageChannels = React.useCallback(() => {
    manageChatChannels(teamID)
  }, [manageChatChannels, teamID])
  const showInfoPanel = Constants.useState(s => s.dispatch.showInfoPanel)
  const onManageNotifications = React.useCallback(() => {
    showInfoPanel(true, 'settings', conversationIDKey)
  }, [showInfoPanel, conversationIDKey])
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const onAuthorClick = (username: string) => {
    showUserProfile(username)
  }

  const joiners2 = React.useMemo(() => {
    return !joiners.length && !leavers.length ? [author] : joiners
  }, [joiners, leavers, author])

  const props = {
    author,
    authorIsYou,
    channelname,
    isAdHoc: teamType === 'adhoc',
    isBigTeam: teamType === 'big',
    joiners: joiners2,
    leavers,
    onAuthorClick,
    onManageChannels,
    onManageNotifications,
    teamname,
    timestamp,
  }
  return <Joined {...props} />
})

export default JoinedContainer
