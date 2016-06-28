import runMode from './platform.native'

const keybaseUrl = runMode !== 'prod' ? 'https://stage0.keybase.io' : 'https://keybase.io'
export default keybaseUrl

export const apiUrl = `${keybaseUrl}/_/api/1.0`
