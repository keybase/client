// @flow
import DeviceName from '../register/set-public-name/index.render'
import Error from './error/index.render'
import HiddenString from '../../util/hidden-string'
import InviteCode from './invite-code.render'
import Passphrase from './passphrase/index.render'
import RequestInviteSuccess from './request-invite-success.render'
import RequesteInvite from './request-invite.render'
import Success from './success/index.render'
import UsernameEmail from './username-email-form.render'
import {isMobile} from '../../constants/platform'

const nullFunc = () => {}

const signupShared = {
  parentProps: isMobile ? {} : {
    style: {
      position: 'relative',
      width: 800,
      height: 580,
    },
  },
  onBack: nullFunc,
}

const inviteShared = {
  ...signupShared,
  onInviteCodeSubmit: nullFunc,
  onRequestInvite: nullFunc,
  waiting: false,
  inviteCode: null,
  inviteCodeErrorText: null,
}

const requestShared = {
  ...signupShared,
  name: null,
  email: null,
  nameErrorText: null,
  emailErrorText: null,
  onRequestInvite: nullFunc,
  waiting: false,
  nameChange: (name: string) => console.log(name),
  emailChange: (email: string) => console.log(email),
}

const userEmailShared = {
  ...signupShared,
  username: null,
  email: null,
  usernameErrorText: null,
  emailErrorText: null,
  submitUserEmail: nullFunc,
  waiting: false,
  usernameChange: (username: string) => console.log(username),
  emailChange: (email: string) => console.log(email),
}

const passphraseShared = {
  ...signupShared,
  passphraseError: null,
  checkPassphrase: nullFunc,
  pass1Update: (pass1: string) => console.log('pass1', pass1),
  pass2Update: (pass2: string) => console.log('pass2', pass2),
  onSubmit: () => console.log('onsubmit'),
  onBack: () => console.log('onback'),
}

const deviceNameShared = {
  ...signupShared,
  onBack: nullFunc,
  onSubmit: nullFunc,
  onChange: nullFunc,
  deviceNameError: null,
  deviceName: '',
  waiting: false,
}

export default {
  'Signup: Invite Code': {
    component: InviteCode,
    mocks: {
      'Start': {
        ...inviteShared,
      },
      'Code': {
        ...inviteShared,
        inviteCode: 'Code Entered',
      },
      'Waiting': {
        ...inviteShared,
        inviteCode: 'Code Entered',
        waiting: true,
      },
      'Error': {
        ...inviteShared,
        inviteCode: 'Code Entered',
        inviteCodeErrorText: 'This is an error',
      },
    },
  },
  'Signup: RequestInviteSuccess': {
    component: RequestInviteSuccess,
    mocks: {
      'Start': {
        ...signupShared,
      },
    },
  },
  'Signup: RequestInvite': {
    component: RequesteInvite,
    mocks: {
      'Start': {
        ...requestShared,
      },
      'Name': {
        ...requestShared,
        name: 'Name',
      },
      'Email': {
        ...requestShared,
        email: 'Email@email.com',
      },
      'Name/Email': {
        ...requestShared,
        name: 'Name',
        email: 'Email@email.com',
      },
      'Name Error': {
        ...requestShared,
        name: 'Name',
        nameErrorText: 'Name bad, smash!',
      },
      'Email Error': {
        ...requestShared,
        email: 'Email@email.com',
        emailErrorText: 'Email bad, booo',
      },
      'Waiting': {
        ...requestShared,
        name: 'Name',
        email: 'Email@email.com',
        waiting: true,
      },
    },
  },
  'Signup: UsernameEmail (Login)': {
    component: UsernameEmail,
    mocks: {
      'Start': {
        ...userEmailShared,
      },
      'Name': {
        ...userEmailShared,
        username: 'Name',
      },
      'Email': {
        ...userEmailShared,
        email: 'Email@email.com',
      },
      'Name/Email': {
        ...userEmailShared,
        username: 'Name',
        email: 'Email@email.com',
      },
      'Name Error': {
        ...userEmailShared,
        username: 'Name',
        usernameErrorText: 'Name bad, smash!',
      },
      'Email Error': {
        ...userEmailShared,
        email: 'Email@email.com',
        emailErrorText: 'Email bad, booo',
      },
      'Waiting': {
        ...userEmailShared,
        username: 'Name',
        email: 'Email@email.com',
        waiting: true,
      },
    },
  },
  'Signup: Error': {
    component: Error,
    mocks: {
      'Start': {
        ...signupShared,
        errorText: new HiddenString('This is an error'),
        restartSignup: nullFunc,
      },
    },
  },
  'Signup: Passphrase': {
    component: Passphrase,
    mocks: {
      'Start': {
        ...passphraseShared,
      },
      'Error': {
        ...passphraseShared,
        passphraseError: new HiddenString('This is an error'),
      },
    },
  },
  'Signup: Success': {
    component: Success,
    mocks: {
      'Start': {
        ...signupShared,
        paperkey: new HiddenString('This is a paper key phase blah blah blah'),
        onFinish: nullFunc,
        onBack: nullFunc,
        title: "Congratulations, you've just joined Keybase!",
      },
    },
  },
  'Signup: Device Name': {
    component: DeviceName,
    mocks: {
      'Start': {
        ...deviceNameShared,
      },
      'Waiting': {
        ...deviceNameShared,
        waiting: true,
      },
      'Name': {
        ...deviceNameShared,
        deviceName: 'A name',
      },
      'Error': {
        ...deviceNameShared,
        deviceNameError: 'Some naming errors',
      },
    },
  },
}
