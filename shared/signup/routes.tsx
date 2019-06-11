export const newRoutes = {
  signupEnterDevicename: {getScreen: () => require('./device-name/container').default, upgraded: true},
  signupEnterEmail: {getScreen: () => require('./email/container').default, upgraded: true},
  signupEnterPhoneNumber: {getScreen: () => require('./phone-number/container').default, upgraded: true},
  signupEnterUsername: {getScreen: () => require('./username/container').default, upgraded: true},
}
