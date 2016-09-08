// @flow

import UpdateEmail from './email'
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

export default {
  UpdateEmail: updateEmailMap,
}
