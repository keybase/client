import GitRoot from './container'
import GitDeleteRepo from './delete-repo/container'
import GitNewRepo from './new-repo/container'
import GitSelectChannel from './select-channel/container'

const gitRoot = {getScreen: (): typeof GitRoot => require('./container').default}

export const newRoutes = {
  gitRoot,
  'settingsTabs.gitTab': gitRoot,
}
export const newModalRoutes = {
  // TODO broken connect
  gitDeleteRepo: {getScreen: (): typeof GitDeleteRepo => require('./delete-repo/container').default},
  gitNewRepo: {getScreen: (): typeof GitNewRepo => require('./new-repo/container').default},
  // TODO broken connect
  gitSelectChannel: {getScreen: (): typeof GitSelectChannel => require('./select-channel/container').default},
}
