// @flow
export function selector(username: string): (store: Object) => ?Object {
  return store => {
    if (store.tracker.trackers[username]) {
      return {
        config: {
          loggedIn: store.config.loggedIn,
          username: store.config.username,
        },
        tracker: {
          trackers: {
            [username]: store.tracker.trackers[username],
          },
        },
      }
    }

    return null
  }
}
