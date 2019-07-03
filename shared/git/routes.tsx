export const newRoutes = {
  gitRoot: {getScreen: () => require('./container').default},
  'settingsTabs.gitTab': {getScreen: () => require('./container').default},
}
export const newModalRoutes = {
  gitDeleteRepo: {getScreen: () => require('./delete-repo/container').default},
  gitNewRepo: {getScreen: () => require('./new-repo/container').default},
  gitSelectChannel: {getScreen: () => require('./select-channel/container').default},
}
