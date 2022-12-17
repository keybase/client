// NEVER use this directly, only through utils
// this is to workaround issues w/ patching for why did you render
import type {TypedState} from '../constants/reducer'
import {useSelector as RRuseSelector, type TypedUseSelectorHook} from 'react-redux'
const useSelector: TypedUseSelectorHook<TypedState> = RRuseSelector
const e = {
  useSelector,
}

export default e
