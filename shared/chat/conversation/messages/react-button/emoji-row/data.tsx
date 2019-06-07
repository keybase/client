import {memoize} from '../../../../../util/memoize'
import {isMobile} from '../../../../../constants/platform'

const getFrequently = memoize(() => require('emoji-mart').frequently)

const getEmojis = memoize(() =>
  isMobile
    ? []
    : getFrequently()
        .get(2)
        .map(name => `:${name}:`)
)

export default getEmojis
