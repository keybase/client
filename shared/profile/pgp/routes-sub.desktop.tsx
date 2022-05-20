import ProfileFinished from './finished.desktop'
import ProfileGenerate from './generate.desktop'
import ProfileImport from './import.desktop'
import ProfilePgp from './choice.desktop'
import ProfileProvideInfo from './info.desktop'

export const newRoutes = {
  profileFinished: {getScreen: (): typeof ProfileFinished => require('./finished.desktop').default},
  profileGenerate: {getScreen: (): typeof ProfileGenerate => require('./generate.desktop').default},
  profileImport: {getScreen: (): typeof ProfileImport => require('./import.desktop').default},
  profilePgp: {getScreen: (): typeof ProfilePgp => require('./choice.desktop').default},
  profileProvideInfo: {getScreen: (): typeof ProfileProvideInfo => require('./info.desktop').default},
}
