import {isIOS} from '../constants/platform'

export const parseUri = (result: {uri: string}): string => {
  return isIOS ? result.uri.replace('file://', '') : result.uri.replace('file:', '')
}
