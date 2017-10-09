// @flow
import {AsyncStorage, Linking} from 'react-native'
import {chatTab, isValidInitialTab} from '../constants/tabs'
import {setInitialState} from './config'

import type {Dispatch, GetState} from '../constants/types/flux'

class RouteStateStorage {
  _getAndClearPromise: Promise<void>

  _getItem = async (): Promise<string> => {
    try {
      return await AsyncStorage.getItem('routeState')
    } catch (e) {
      console.warn('[RouteState] Error getting item:', e)
      throw e
    }
  }

  _setItem = async (item: Object): Promise<void> => {
    console.log('[RouteState] Setting item:', item)
    const s = JSON.stringify(item)
    try {
      await AsyncStorage.setItem('routeState', s)
    } catch (e) {
      console.warn('[RouteState] Error setting item:', e)
      throw e
    }
  }

  _removeItem = async (): Promise<void> => {
    console.log('[RouteState] Removing item')
    try {
      return await AsyncStorage.removeItem('routeState')
    } catch (e) {
      console.warn('[RouteState] Error removing item:', e)
      throw e
    }
  }

  _getAndClearItem = async (dispatch: Dispatch, getState: GetState): Promise<void> => {
    let s = await this._getItem()

    let item
    try {
      item = JSON.parse(s)
    } catch (e) {
      console.warn('[RouteState] Error parsing item:', s, e)
      throw e
    }

    // Before we actually nav to the saved routeState, we should clear
    // it for future runs of the app.  That way, if the act of navigating
    // to this route causes a crash for some reason, we won't get stuck
    // in a loop of trying to restore the bad state every time we launch.
    await this._removeItem()

    console.log('[RouteState] Got item:', item)

    if (!item) {
      return
    }

    if (item.tab) {
      if (item.selectedConversationIDKey) {
        await dispatch(setInitialState({conversation: item.selectedConversationIDKey, tab: chatTab}))
      } else {
        await dispatch(setInitialState({tab: item.tab}))
      }
    }
  }

  load = async (dispatch: Dispatch, getState: GetState): Promise<void> => {
    let url
    try {
      url = await Linking.getInitialURL()
    } catch (e) {
      console.warn('[RouteState] Error getting initial URL:', e)
      throw e
    }

    if (url) {
      console.log('[RouteState] initial URL:', url)
      await dispatch(setInitialState({url}))
      return
    }

    // Make sure that concurrent loads return the same result until
    // the next call to store/clear.
    if (this._getAndClearPromise) {
      console.log('[RouteState] Using existing getAndClear promise')
    } else {
      console.log('[RouteState] Creating new getAndClear promise')
      this._getAndClearPromise = this._getAndClearItem(dispatch, getState)
    }

    await this._getAndClearPromise
  }

  store = async (dispatch: Dispatch, getState: GetState): Promise<void> => {
    const state = getState()
    if (!state.routeTree.loggedInUserNavigated) {
      console.log('[RouteState] Ignoring store before route changed')
      return
    }

    if (this._getAndClearPromise) {
      console.log('[RouteState] Removing getAndClear promise')
      delete this._getAndClearPromise
    }

    const routeState = state.routeTree.routeState
    const item = {}

    const selectedTab = routeState.selected
    if (isValidInitialTab(selectedTab)) {
      item.tab = selectedTab
      if (selectedTab === chatTab) {
        const tab = routeState.children.get(chatTab)
        if (tab && tab.selected) {
          item.selectedConversationIDKey = tab.selected
        }
      }
      await this._setItem(item)
    } else {
      // If we have a selected invalid tab, we're most likely signed
      // out. In any case, just clobber the store so we load the
      // default initial tab on the next login.
      console.log('[RouteState] Invalid initial tab:', selectedTab)
      await this._removeItem()
    }
  }

  clear = async (dispatch: Dispatch, getState: GetState): Promise<void> => {
    const state = getState()
    if (!state.routeTree.loggedInUserNavigated) {
      console.log('[RouteState] Ignoring clear before route changed')
      return
    }

    if (this._getAndClearPromise) {
      console.log('[RouteState] Removing getAndClear promise')
      delete this._getAndClearPromise
    }

    await this._removeItem()
  }
}

export {RouteStateStorage}
