// @flow

import type {Dispatch, GetState} from '../constants/types/flux'

// For now, don't save any route state for desktop.
class RouteStateStorage {
  load = async (dispatch: Dispatch, getState: GetState): Promise<void> => {}
  store = async (dispatch: Dispatch, getState: GetState): Promise<void> => {}
  clear = async (dispatch: Dispatch, getState: GetState): Promise<void> => {}
}

export {RouteStateStorage}
