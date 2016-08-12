// @flow
import type {TypedAction} from '../constants/types/flux'

export type State = {
  reloading: boolean
}

const initialState = {
  reloading: false,
}

export const updateReloading = 'hmr:updateReloading'
export type UpdateReloading = TypedAction<'hmr:updateReloading', {reloading: boolean}, void>

export default function (state: State = initialState, action: UpdateReloading) {
  if (action.type === updateReloading && !action.error) {
    return {
      reloading: action.payload.reloading,
    }
  }
  return state
}
