import * as React from 'react'
import * as Container from '../../util/container'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import UnconnectedFollowButton from '../../profile/user/actions/follow-button'
import * as Tracker2Constants from '../../constants/tracker2'

type FollowProps = {
  username: string
  small?: boolean
}
const getFollowWaitingKey = (username: string) => `settings:followButton:${username}`

export const FollowButton = (props: FollowProps) => {
  const {username} = props
  const dispatch = Container.useDispatch()
  const userDetails = Container.useSelector(state => Tracker2Constants.getDetails(state, username))
  const followThem = Container.useSelector(state => Tracker2Constants.followThem(state, username))
  const followsYou = Container.useSelector(state => Tracker2Constants.followsYou(state, username))
  const {guiID} = userDetails

  React.useEffect(() => {
    if (!guiID) {
      dispatch(
        Tracker2Gen.createShowUser({
          asTracker: false,
          skipNav: true,
          username: username,
        })
      )
    }
  }, [username, guiID, dispatch])

  const onFollow = React.useCallback(
    () => dispatch(Tracker2Gen.createChangeFollow({follow: true, guiID})),
    [dispatch, guiID]
  )
  const onUnfollow = React.useCallback(
    () => dispatch(Tracker2Gen.createChangeFollow({follow: false, guiID})),
    [dispatch, guiID]
  )

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
