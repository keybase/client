import ProfileFinished from './finished.desktop'
import ProfileGenerate from './generate.desktop'
import ProfileImport from './import.desktop'
import ProfilePgp from './choice.desktop'
import ProfileProvideInfo from './info.desktop'

export const newRoutes = {
  profileFinished: {
    getScreen: (): typeof ProfileFinished => require('./finished.desktop').default,
    upgraded: true,
  },
  profileGenerate: {
    getScreen: (): typeof ProfileGenerate => require('./generate.desktop').default,
    upgraded: true,
  },
  profileImport: {getScreen: (): typeof ProfileImport => require('./import.desktop').default, upgraded: true},
  profilePgp: {getScreen: (): typeof ProfilePgp => require('./choice.desktop').default, upgraded: true},
  profileProvideInfo: {
    getScreen: (): typeof ProfileProvideInfo => require('./info.desktop').default,
    upgraded: true,
  },
}
