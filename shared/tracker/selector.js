// @flow
import {type TypedState} from '../constants/reducer'
export function selector(username: string): (store: TypedState) => ?Object {
  return store => {
    console.log('in selector', store.chat)    
    console.log('in selector 2', store.chat.teamJoinError)
    if (store.chat && store.tracker.userTrackers[username] || store.tracker.nonUserTrackers[username]) {
      return {
        chat: {
          teamJoinError: store.chat.teamJoinError,
          teamJoinSuccess: store.chat.teamJoinSuccess,
        },
        config: {
          loggedIn: store.config.loggedIn,
          username: store.config.username,
        },
        tracker: {
          userTrackers: {
            [username]: {
              ...store.tracker.userTrackers[username],
              trackers: [],
              tracking: [],
            },
          },
          nonUserTrackers: {
            [username]: {
              ...store.tracker.nonUserTrackers[username],
            },
          },
        },
      }
    }

    return null
  }
}
