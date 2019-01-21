// @flow
import {memoize} from '../../../../../util/memoize'
import {isMobile} from '../../../../../constants/platform'

const getFrequently = memoize<void, void, void, void, {get: number => Array<string>}>(
  () => require('emoji-mart').frequently
)

const getEmojis = () => (isMobile ? [] : getFrequently().get(2))

export default getEmojis
