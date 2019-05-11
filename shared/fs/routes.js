// @flow
export const newRoutes = {
  fsRoot: {getScreen: () => require('./container').default, upgraded: true},
  main: {getScreen: () => require('./container').default, upgraded: true},
  'settingsTabs.fsTab': {getScreen: () => require('./container').default, upgraded: true},
}

export const newModalRoutes = {
  barePreview: {getScreen: () => require('./filepreview').BarePreview},
  destinationPicker: {getScreen: () => require('./destination-picker/container').default, upgraded: true},
  reallyDelete: {getScreen: () => require('./really-delete/container').default, upgraded: true},
  sendAttachmentToChat: {
    getScreen: () => require('./send-attachment-to-chat/container').default,
    upgraded: true,
  },
  sendLinkToChat: {getScreen: () => require('./send-link-to-chat/container').default, upgraded: true},
}
