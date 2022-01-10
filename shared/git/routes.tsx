import type GitRoot from './container'
import type GitDeleteRepo from './delete-repo/container'
import type GitNewRepo from './new-repo/container'
import type GitSelectChannel from './select-channel'

const gitRoot = {getScreen: (): typeof GitRoot => require('./container').default}

export const newRoutes = {
  gitRoot,
}
export const newModalRoutes = {
  gitDeleteRepo: {getScreen: (): typeof GitDeleteRepo => require('./delete-repo/container').default},
  gitNewRepo: {getScreen: (): typeof GitNewRepo => require('./new-repo/container').default},
  gitSelectChannel: {getScreen: (): typeof GitSelectChannel => require('./select-channel').default},
}
