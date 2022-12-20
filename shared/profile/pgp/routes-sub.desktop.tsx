import type ProfileFinished from './finished.desktop'
import type ProfileGenerate from './generate.desktop'
import type ProfileImport from './import.desktop'
import type ProfilePgp from './choice.desktop'
import type ProfileProvideInfo from './info.desktop'

export const newRoutes = {
  profileFinished: {getScreen: (): typeof ProfileFinished => require('./finished.desktop').default},
  profileGenerate: {getScreen: (): typeof ProfileGenerate => require('./generate.desktop').default},
  profileImport: {getScreen: (): typeof ProfileImport => require('./import.desktop').default},
  profilePgp: {getScreen: (): typeof ProfilePgp => require('./choice.desktop').default},
  profileProvideInfo: {getScreen: (): typeof ProfileProvideInfo => require('./info.desktop').default},
}
