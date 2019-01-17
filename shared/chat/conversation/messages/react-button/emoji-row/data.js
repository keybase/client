// @flow
import {memoize} from '../../../../../util/memoize'
import {isMobile} from '../../../../../constants/platform'

const getEmojis = memoize<void, void, void, void, Array<string>>(() => {
  if (isMobile) {
    // TODO implement using AsyncStorage or similar
    return []
  }
  const {frequently} = require('emoji-mart')
  // array of <= 8 most frequently used emojis
  return frequently.get(2)
})

export default getEmojis
