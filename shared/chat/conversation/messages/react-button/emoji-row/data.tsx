import {memoize} from '../../../../../util/memoize'
import {isMobile} from '../../../../../constants/platform'

const getFrequently = memoize(() => require('emoji-mart').frequently)

const getEmojis = memoize<number, void, void, void, Array<string>>(() =>
  isMobile
    ? []
    : getFrequently()
        .get(2)
        .map<string>(name => `:${name}:`)
)

export default getEmojis
