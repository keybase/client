import {constants} from '../constants/types/keybase-v1'

const nameFix = fromGo => fromGo.replace(/_/g, '').toLowerCase()

export const errorMap = Object.keys(constants.StatusCode).reduce((acc, cur) => {
  acc[nameFix(cur)] = constants.StatusCode[cur]
  return acc
}, {})

const niceMap = {
  alreadyloggedin: () => 'You are already logged in',
  apinetworkerror: () => 'Networking error, try again',
  badloginpassword: () => 'Invalid login',
  sckeynomatchinggpg: () => 'No matching private GPG keys found on this device'
}

export default class EngineError extends Error {
  constructor (err) {
    if (!err) {
      err = {}
    }
    super(err.desc)
    this.code = err.code
    this.desc = err.desc
    this.name = err.name
    this.raw = err
  }

  toString () {
    const niceFunc = niceMap[nameFix(this.name)]
    return niceFunc && niceFunc(this.err) || this.desc || this.code
  }
}

export type EngineErrorType = {
  code: number,
  desc: ?string,
  name: string,
  raw: ?any,
  toString: () => string
}
