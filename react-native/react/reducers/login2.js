'use strict'

import * as Constants from '../constants/login2'
import Immutable from 'immutable'

import * as Actions from '../actions/login2'

const DEBUG_MY_ROLE = Constants.codePageDeviceRoleExistingPhone
const DEBUG_OTHER_ROLE = Constants.codePageDeviceRoleNewPhone

const initialState = {
  username: '',
  passphrase: '',
  codePage: {
    otherDeviceRole: DEBUG_OTHER_ROLE,
    myDeviceRole: DEBUG_MY_ROLE,
    mode: Actions.defaultModeForDeviceRoles(DEBUG_MY_ROLE, DEBUG_OTHER_ROLE),
    cameraBrokenMode: false,
    codeCountDown: 0,
    textCode: null,
    qrScanned: null,
    qrCode: null
  }
}

export default function (state = initialState, action) {
  switch (action.type) {
    case Constants.actionSubmitUserPass:
      return {
        ...state,
        username: action.username,
        passphrase: action.passphrase
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
    case Constants.setQRCode: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          qrCode: action.qrCode
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
    case Constants.cameraBrokenMode: {
      const s = Immutable.fromJS(state)
      return s.mergeDeep({
        codePage: {
          cameraBrokenMode: action.broken
        }
      }).toJS()
    }
    default:
      return state
  }
}
