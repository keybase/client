// @flow
import {runMode} from './platform'

const keybaseUrl = runMode !== 'prod'
  ? 'https://stage0.keybase.io'
  : 'https://keybase.io'

export const helpUrl = `${keybaseUrl}/getting-started`
export const apiUrl = `${keybaseUrl}/_/api/1.0`
export default keybaseUrl
