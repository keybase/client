// @flow

import PgpAdd from './add'
import type {DumbComponentMap} from '../../constants/types/more'

const addBase = {
  fullName: 'Chris Coyne',
  email1: 'chris@bitcoyne.com',
  email2: null,
  email3: null,
  errorText: null,
  errorEmail1: false,
  errorEmail2: false,
  errorEmail3: false,
  onChangeFullName: (next) => console.log('clicked:', 'onChangeFullName'),
  onChangeEmail1: (next) => console.log('clicked: onChangeEmail1'),
  onChangeEmail2: (next) => console.log('clicked: onChangeEmail2'),
  onChangeEmail3: (next) => console.log('clicked: onChangeEmail3'),
  onCancel: () => console.log('clicked: onCancel'),
  onNext: () => console.log('clicked: onNext'),
}

const addMap: DumbComponentMap<PgpAdd> = {
  component: PgpAdd,
  mocks: {
    'Normal': addBase,
    'Empty': {
      ...addBase,
      email1: null,
      fullName: null,
    },
    'One Error - Email': {
      ...addBase,
      errorText: 'Some email addresses are invalid. Please fix!',
      errorEmail1: true,
    },
  },
}

export default {
  'Add Pgp': addMap,
}
