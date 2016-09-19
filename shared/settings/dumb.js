// @flow

import UpdateEmail from './email'
import Landing from './landing'
import DeleteMe from './delete'

import type {DumbComponentMap} from '../constants/types/more'

const updateEmailBase = {
  email: 'party@mypla.ce',
  isVerified: true,
  onChangeEmail: () => console.log('onChangeEmail'),
  onSave: () => console.log('onSave'),
  onResendConfirmationCode: null,
}

const updateEmailMap: DumbComponentMap<UpdateEmail> = {
  component: UpdateEmail,
  mocks: {
    'Normal': updateEmailBase,
    'Normal - No Email': {
      ...updateEmailBase,
      isVerified: false,
      email: null,
    },
    'Not Verified - No Email': {
      ...updateEmailBase,
      isVerified: false,
    },
    'Resend Confirmation': {
      ...updateEmailBase,
      onResendConfirmationCode: () => console.log('onResendConfirmationCode'),
    },
  },
}

const planBase = {
  onUpgrade: l => console.log('onUpgrade to', l),
  onDowngrade: l => console.log('onDowngrade to', l),
  onInfo: l => console.log('onInfo for', l),
  selectedLevel: 'Basic',
  freeSpace: '5GB',
  freeSpacePercentage: 0.5,
  lowSpaceWarning: false,
  onChangePaymentInfo: () => console.log('onChangePaymentInfo'),
  paymentInfo: null,
}

const accountBase = {
  email: 'party@mypla.ce',
  isVerified: true,
  onChangeEmail: () => console.log('onChangeEmail'),
  onChangePassphrase: () => console.log('onChangePassphrase'),
}

const landingBase = {
  plan: planBase,
  account: accountBase,
}

const goldBase = {
  ...landingBase,
  plan: {
    ...planBase,
    selectedLevel: 'Gold',
    lowSpaceWarning: true,
    freeSpacePercentage: 0.9,
    paymentInfo: {
      name: 'Jessica Jones',
      last4Digits: '1337',
      isBroken: false,
    },
  },
}

const landingMap: DumbComponentMap<Landing> = {
  component: Landing,
  mocks: {
    'Normal': landingBase,
    'Normal - Not Verified email': {...landingBase, account: {...landingBase.account, isVerified: false}},
    'Gold Plan': goldBase,
    'Gold Plan - Broken Payment': {
      ...goldBase,
      plan: {
        ...goldBase.plan,
        paymentInfo: {
          ...goldBase.plan.paymentInfo,
          isBroken: true,
        },
      },
    },
  },
}

const deleteMeMap: DumbComponentMap<DeleteMe> = {
  component: DeleteMe,
  mocks: {
    'Normal': {
      onDelete: () => console.log('onDelete clicked'),
      onRevokeCurrentDevice: () => console.log('onRevokeCurrentDevice clicked'),
      parentProps: {
        style: {
          height: 500,
          display: 'flex',
        },
      },
    },
  },
}

export default {
  UpdateEmail: updateEmailMap,
  Landing: landingMap,
  DeleteMe: deleteMeMap,
}
