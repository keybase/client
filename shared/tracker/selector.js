// @flow
import {type TypedState} from '../constants/reducer'
export function selector(username: string): (store: TypedState) => ?Object {
  return store => {
    if (store.tracker.userTrackers[username] || store.tracker.nonUserTrackers[username]) {
      return {
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
