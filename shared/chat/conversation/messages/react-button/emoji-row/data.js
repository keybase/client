// @flow
import {memoize} from '../../../../../util/memoize'
import {isMobile} from '../../../../../constants/platform'

const getFrequently = memoize<void, void, void, void, {get: number => Array<string>}>(
  () => require('emoji-mart').frequently
)

const getEmojis = memoize<number, void, void, void, Array<string>>(() =>
  isMobile
    ? []
    : getFrequently()
        .get(2)
        .map<string>(name => `:${name}:`)
)

export default getEmojis
