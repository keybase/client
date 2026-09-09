import isEqual from 'lodash/isEqual'
import {EnginePriority, registerEngineHandlers} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {useFollowerState} from '@/stores/followers'

// The follower store is imported by other stores and so deliberately depends on
// nothing; its engine wiring, which needs the current user, lives out here.
registerEngineHandlers(
  {
    'keybase.1.NotifyTracking.trackingChanged': action => {
      const {isTracking, username} = action.payload.params
      useFollowerState.getState().dispatch.updateFollowing(username, isTracking)
    },
    'keybase.1.NotifyTracking.trackingInfo': action => {
      const {uid, followers: _newFollowers, followees: _newFollowing} = action.payload.params
      if (useCurrentUserState.getState().uid !== uid) {
        return
      }
      const newFollowers = new Set(_newFollowers)
      const newFollowing = new Set(_newFollowing)
      const {following: oldFollowing, followers: oldFollowers, dispatch} = useFollowerState.getState()
      dispatch.replace(
        isEqual(newFollowers, oldFollowers) ? oldFollowers : newFollowers,
        isEqual(newFollowing, oldFollowing) ? oldFollowing : newFollowing
      )
    },
  },
  {id: 'stores/followers-engine', priority: EnginePriority.shared}
)
