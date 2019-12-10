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
  const dispatch = Container.useDispatch()
  const userDetails = Container.useSelector(state => Tracker2Constants.getDetails(state, props.username))
  const followThem = Container.useSelector(state => Tracker2Constants.followThem(state, props.username))
  const followsYou = Container.useSelector(state => Tracker2Constants.followsYou(state, props.username))

  React.useEffect(() => {
    if (!userDetails.guiID) {
      dispatch(
        Tracker2Gen.createShowUser({
          asTracker: false,
          skipNav: true,
          username: props.username,
        })
      )
    }
  }, [props.username, userDetails.guiID, dispatch])

  const onChangeFollow = (follow: boolean) =>
    dispatch(Tracker2Gen.createChangeFollow({follow, guiID: userDetails.guiID}))

  return (
    <UnconnectedFollowButton
      disabled={userDetails.username !== props.username}
      following={followThem}
      followsYou={followsYou}
      waitingKey={[getFollowWaitingKey(props.username), Tracker2Constants.profileLoadWaitingKey]}
      small={props.small}
      onFollow={() => onChangeFollow(true)}
      onUnfollow={() => onChangeFollow(false)}
    />
  )
}
