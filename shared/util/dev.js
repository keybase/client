// @flow
import {createSelectorCreator, defaultMemoize} from 'reselect'

const injectReactQueryParams = (url: string): string => {
  if (!__DEV__ || process.env.KEYBASE_DISABLE_REACT_PERF) {
    return url
  }

  return `${url}${url.indexOf('?') === -1 ? '?' : '&'}react_perf`
}

// This is a helper for creatorSelector from reselect. Just use this instead of creatorSelector() and it'll
// output logs when the selector isn't memoized so you can debug why your cache isn't being reused
const debugCreateSelector = createSelectorCreator(
  defaultMemoize,
  (a, b) => {
    const val = a === b
    console.log('DebugCreateSelectorCompare: ', val ? 'Cached' : 'MISS', a, b)
    return val
  }
)

export {
  injectReactQueryParams,
  debugCreateSelector,
}
