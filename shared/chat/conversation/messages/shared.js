// @flow
import {globalColors} from '../../../styles'

const marginColor = (user: string, isYou: boolean, isFollowing: boolean, isBroken: boolean) => {
  if (isYou) {
    return 'transparent'
  } else if (isBroken) {
    return globalColors.red
  }
  return isFollowing ? globalColors.green2 : globalColors.blue
}

const colorForAuthor = (user: string, isYou: boolean, isFollowing: boolean, isBroken: boolean) =>
  isYou ? globalColors.black_75 : marginColor(user, isYou, isFollowing, isBroken)

export {marginColor, colorForAuthor}
