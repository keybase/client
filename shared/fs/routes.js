// @flow
export const newRoutes = {
  fsRoot: {getScreen: () => require('./container').default, upgraded: true},
  main: {getScreen: () => require('./container').default, upgraded: true},
  'settingsTabs.fsTab': {getScreen: () => require('./container').default, upgraded: true},
}

export const newModalRoutes = {
  barePreview: {getScreen: () => require('./filepreview').BarePreview},
  confirmDelete: {
    getScreen: () => require('./common/path-item-action/confirm-delete/container').default,
    upgraded: true,
  },
  destinationPicker: {
    getScreen: () => require('./browser/destination-picker/container').default,
    upgraded: true,
  },
  sendAttachmentToChat: {
    getScreen: () => require('./send-to-chat/attachment/container').default,
    upgraded: true,
  },
  sendLinkToChat: {getScreen: () => require('./send-to-chat/link/container').default, upgraded: true},
}
