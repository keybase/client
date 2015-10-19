'use strict'

import * as Constants from '../constants/login2'
import Immutable from 'immutable'

const initialState = {
  username: '',
  passphrase: '',
  codePage: {
    otherDeviceRole: Constants.codePageDeviceRoleExistingComputer,
    myDeviceRole: Constants.codePageDeviceRoleNewPhone,
    mode: Constants.codePageModeScanCode,
    codeCountDown: 0,
    textCode: null,
    qrScanned: null,
    qrCode: null
  },
  registerUserPassError: null,
  registerUserPassLoading: false
}

export default function (state = initialState, action) {
  switch (action.type) {
    case Constants.login:
      return {
        ...state,
        username: action.username,
        passphrase: action.passphrase
      }
    case Constants.loginDone:
      return {
        ...state,
        username: action.username
      }
    case Constants.setCodeState: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          myDeviceRole: action.myDeviceRole,
          otherDeviceRole: action.otherDeviceRole
        }
      }).toJS()
    }
    case Constants.setCodeMode: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          mode: action.mode
        }
      }).toJS()
    }
    case Constants.setCountdown: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          codeCountDown: action.countDown
        }
      }).toJS()
    }
    case Constants.setTextCode: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          textCode: action.text
        }
      }).toJS()
    }
    case Constants.qrGenerate: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          qrCode: null
        }
      }).toJS()
    }
    case Constants.qrGenerated: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          qrCode: action.qrCode
        }
      }).toJS()
    }
    case Constants.qrScanned: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          qrScanned: action.code
        }
      }).toJS()
    }
    case Constants.actionRegisterUserPassSubmit:
      return {
        ...state,
        username: action.username,
        passphrase: action.passphrase,
        registerUserPassError: null,
        registerUserPassLoading: true
      }
    case Constants.actionRegisterUserPassDone:
      return {
        ...state,
        registerUserPassError: action.error,
        registerUserPassLoading: false
      }
    default:
      return state
  }
}
