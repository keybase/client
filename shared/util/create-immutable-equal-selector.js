// @flow
import {createSelectorCreator, defaultMemoize} from 'reselect'
import {is} from 'immutable'

// create a "selector creator" that uses immutable.is instead of ===
const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, is)

export default createImmutableEqualSelector
