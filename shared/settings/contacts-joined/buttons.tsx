import * as C from '../../constants'
import * as React from 'react'
import * as Tracker2Constants from '../../constants/tracker2'
import UnconnectedFollowButton from '../../profile/user/actions/follow-button'

type FollowProps = {
  username: string
  small?: boolean
}
const getFollowWaitingKey = (username: string) => `settings:followButton:${username}`

export const FollowButton = (props: FollowProps) => {
  const {username} = props
  const userDetails = C.useTrackerState(s => Tracker2Constants.getDetails(s, username))
  const followThem = C.useFollowerState(s => s.following.has(username))
  const followsYou = C.useFollowerState(s => s.followers.has(username))
  const {guiID} = userDetails

  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const changeFollow = C.useTrackerState(s => s.dispatch.changeFollow)

  React.useEffect(() => {
    if (!guiID) {
      showUser(username, false, true)
    }
  }, [username, guiID, showUser])

  const onFollow = React.useCallback(() => changeFollow(guiID, true), [changeFollow, guiID])
  const onUnfollow = React.useCallback(() => changeFollow(guiID, false), [changeFollow, guiID])

  const waitingKey = React.useMemo(
    () => [getFollowWaitingKey(username), Tracker2Constants.profileLoadWaitingKey],
    [username]
  )

  return (
    <UnconnectedFollowButton
      disabled={userDetails.username !== username}
      following={followThem}
      followsYou={followsYou}
      waitingKey={waitingKey}
      small={props.small}
      onFollow={onFollow}
      onUnfollow={onUnfollow}
    />
  )
}
