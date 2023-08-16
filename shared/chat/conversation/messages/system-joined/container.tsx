import * as C from '../../../../constants'
import * as React from 'react'
import Joined from '.'
import type * as T from '../../../../constants/types'

type OwnProps = {message: T.Chat.MessageSystemJoined}

const JoinedContainer = React.memo(function JoinedContainer(p: OwnProps) {
  const {message} = p
  const {joiners, author, leavers, timestamp} = message

  const meta = C.useChatContext(s => s.meta)
  const {channelname, teamType, teamname, teamID} = meta

  const you = C.useCurrentUserState(s => s.username)
  const authorIsYou = you === author

  const manageChatChannels = C.useTeamsState(s => s.dispatch.manageChatChannels)
  const onManageChannels = React.useCallback(() => {
    manageChatChannels(teamID)
  }, [manageChatChannels, teamID])
  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const onManageNotifications = React.useCallback(() => {
    showInfoPanel(true, 'settings')
  }, [showInfoPanel])
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
