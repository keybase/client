import * as Container from '../util/container'
import type * as Types from '../constants/types/waiting'
import * as WaitingGen from '../actions/waiting-gen'
import type {RPCError} from '../util/errors'

// set to true to see helpful debug info
const debugWaiting = false && __DEV__

const changeHelper = (
  counts: Map<string, number>,
  errors: Map<string, RPCError | undefined>,
  keys: string | Array<string>,
  diff: 1 | -1,
  error?: RPCError
) => {
  getKeys(keys).forEach(k => {
    const oldCount = counts.get(k) || 0
    // going from 0 => 1, clear errors
    if (oldCount === 0 && diff === 1) {
      errors.delete(k)
    } else {
      if (error) {
        errors.set(k, error)
      }
    }
    const newCount = oldCount + diff
    if (newCount === 0) {
      counts.delete(k)
    } else {
      counts.set(k, newCount)
    }
  })

  debugWaiting && console.log('DebugWaiting:', keys, new Map(counts), new Map(errors))
}

const initialState: Types.State = {
  counts: new Map<string, number>(),
  errors: new Map<string, RPCError>(),
}

const getKeys = (k: string | Array<string>) => {
  if (typeof k === 'string') return [k]
  return k
}

export default Container.makeReducer<WaitingGen.Actions, Types.State>(initialState, {
  [WaitingGen.resetStore]: draftState => {
    // Keep the old values else the keys will be all off and confusing
    debugWaiting && console.log('DebugWaiting:', '*resetStore*', draftState)
  },
  [WaitingGen.decrementWaiting]: (draftState, action) => {
    changeHelper(draftState.counts, draftState.errors, action.payload.key, -1, action.payload.error)
  },
  [WaitingGen.incrementWaiting]: (draftState, action) => {
    changeHelper(draftState.counts, draftState.errors, action.payload.key, 1)
  },
  [WaitingGen.clearWaiting]: (draftState, action) => {
    const {counts, errors} = draftState
    debugWaiting && console.log('DebugWaiting: clear', action.payload.key)
    getKeys(action.payload.key).forEach(key => {
      counts.delete(key)
      errors.delete(key)
    })
  },
  [WaitingGen.batchChangeWaiting]: (draftState, action) => {
    debugWaiting && console.log('DebugWaiting: batch', action.payload.changes)
    action.payload.changes.forEach(({key, increment, error}) => {
      changeHelper(draftState.counts, draftState.errors, key, increment ? 1 : -1, error)
    })
  },
})
