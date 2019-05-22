export const newRoutes = {
  profileFinished: {getScreen: () => require('./finished.desktop').default, upgraded: true},
  profileGenerate: {getScreen: () => require('./generate.desktop').default, upgraded: true},
  profileImport: {getScreen: () => require('./import.desktop').default, upgraded: true},
  profilePgp: {getScreen: () => require('./choice.desktop').default, upgraded: true},
  profileProvideInfo: {getScreen: () => require('./info.desktop').default, upgraded: true},
}
