import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ConfigConstants from '../../../../constants/config'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as React from 'react'
import * as TeamsGen from '../../../../actions/teams-gen'
import Joined from '.'
import type * as Types from '../../../../constants/types/chat2'

type OwnProps = {message: Types.MessageSystemJoined}

const JoinedContainer = React.memo(function JoinedContainer(p: OwnProps) {
  const {message} = p
  const {joiners, author, conversationIDKey, leavers, timestamp} = message

  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {channelname, teamType, teamname, teamID} = meta

  const you = ConfigConstants.useConfigState(s => s.username)
  const authorIsYou = you === author

  const dispatch = Container.useDispatch()
  const onManageChannels = React.useCallback(() => {
    dispatch(TeamsGen.createManageChatChannels({teamID}))
  }, [dispatch, teamID])
  const onManageNotifications = React.useCallback(() => {
    dispatch(
      Chat2Gen.createShowInfoPanel({
        conversationIDKey,
        show: true,
        tab: 'settings',
      })
    )
  }, [dispatch, conversationIDKey])
  const onAuthorClick = (username: string) => {
    dispatch(ProfileGen.createShowUserProfile({username}))
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
