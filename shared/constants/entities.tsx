import * as I from 'immutable'
import * as Types from './types/entities'

export const makeState = I.Record<Types._State>({
  searchQueryToResult: I.Map(),
  searchResults: I.Map(),
})
