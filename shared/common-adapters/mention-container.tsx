import * as ProfileGen from '../actions/profile-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import Mention, {type OwnProps} from './mention'
import {isSpecialMention} from '../constants/chat2'
import * as Container from '../util/container'

export default (ownProps: OwnProps) => {
  let {username} = ownProps

  username = username.toLowerCase()
  const theme = Container.useSelector(state => {
    if (isSpecialMention(username)) {
      return 'highlight' as const
    } else {
      if (state.config.username === username) {
        return 'highlight' as const
      } else if (state.config.following.has(username)) {
        return 'follow' as const
      }
      return 'nonFollow' as const
    }
  })

  const dispatch = Container.useDispatch()

  const _onClick = () => {
    if (Container.isMobile) {
      dispatch(ProfileGen.createShowUserProfile({username}))
    } else {
      dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
    }
  }
  const onClick = isSpecialMention(username) ? undefined : _onClick

  const props = {
    onClick,
    theme,
    username,
  }

  return <Mention {...props} />
}
