// @flow
import {constants} from '../constants/types/keybase-v1'

const nameFix = fromGo => fromGo.replace(/_/g, '').toLowerCase()

const errorMap: {[key: string]: ?string} = Object.keys(constants.StatusCode).reduce((acc, cur) => {
  acc[nameFix(cur)] = constants.StatusCode[cur]
  return acc
}, {})

const niceMap = {
  alreadyloggedin: () => 'You are already logged in',
  apinetworkerror: () => 'Networking error, try again',
  badloginpassword: () => 'Invalid login',
  sckeynomatchinggpg: () => 'No matching private GPG keys found on this device',
}

class EngineError extends Error {
  raw: any;

  constructor (err: any) {
    if (!err) {
      err = {}
    }

    const niceFunc = niceMap[nameFix(err.name)]
    super(niceFunc && niceFunc(err) || err.desc || err.code)
    this.raw = err
  }
}

export type EngineErrorType = {
  raw: any,
  message: string
}

export {
  errorMap,
}

export default EngineError
