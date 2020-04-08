import NoPGP from './no-pgp.native'

export const newModalRoutes = {
  profilePgp: {getScreen: (): typeof NoPGP => require('./no-pgp.native').default},
}
