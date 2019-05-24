export const newRoutes = {
  codePage: {getScreen: () => require('./code-page/container').default, upgraded: true},
  error: {getScreen: () => require('./error/container').default, upgraded: true},
  forgotUsername: {getScreen: () => require('./forgot-username/container').default},
  gpgSign: {getScreen: () => require('./gpg-sign/container').default, upgraded: true},
  paperkey: {getScreen: () => require('./paper-key/container').default, upgraded: true},
  password: {getScreen: () => require('./password/container').default, upgraded: true},
  selectOtherDevice: {getScreen: () => require('./select-other-device/container').default, upgraded: true},
  setPublicName: {getScreen: () => require('./set-public-name/container').default, upgraded: true},
  username: {getScreen: () => require('./username-or-email/container').default, upgraded: true},
}
export const newModalRoutes = {}
