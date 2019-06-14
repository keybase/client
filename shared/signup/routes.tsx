export const newRoutes = {
  signupEnterDevicename: {getScreen: () => require('./device-name/container').default, upgraded: true},
  signupEnterEmail: {getScreen: () => require('./email/container').default, upgraded: true},
  signupEnterUsername: {getScreen: () => require('./username/container').default, upgraded: true},
}

// Some screens in signup show up after we've actually signed up
export const newModalRoutes = {
  signupEnterPhoneNumber: {getScreen: () => require('./phone-number/container').default, upgraded: true},
  signupVerifyPhoneNumber: {
    getScreen: () => require('./phone-number/verify-container').default,
    upgraded: true,
  },
}
