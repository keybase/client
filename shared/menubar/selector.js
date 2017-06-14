// @flow
export function selector(): (store: Object) => Object {
  return store => {
    return {
      config: {
        username: store.config.username,
        loggedIn: store.config.loggedIn,
        kbfsPath: store.config.kbfsPath,
        extendedConfig: store.config.extendedConfig,
      },
      notifications: {
        // This function is called in two contexts, one with immutable (main window deciding what to send) and one without (node thread sending to remote). This is VERY confusing and should change but
        // this is the only instance of a remote store we have that has immutable. i have some better ideas than this that have to wait until after mobile (CN)
        navBadges: store.notifications.get
          ? store.notifications.get('navBadges').toJS()
          : store.notifications.navBadges,
      },
      favorite: store.favorite,
      dev: {
        reloading: store.dev.reloading,
      },
    }
  }
}
