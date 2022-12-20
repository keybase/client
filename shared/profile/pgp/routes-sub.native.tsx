import type NoPGP from './no-pgp.native'

export const newRoutes = {
  profilePgp: {getScreen: (): typeof NoPGP => require('./no-pgp.native').default},
}
