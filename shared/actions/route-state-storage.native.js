// @flow
import logger from '../logger'
import {AsyncStorage, Linking} from 'react-native'
import {chatTab, isValidInitialTab} from '../constants/tabs'
import {getPath} from '../route-tree'
import * as ConfigGen from './config-gen'

import type {Dispatch, GetState} from '../constants/types/flux'

// TODO saga-ize this and get rid of promise interface

class RouteStateStorage {
  _getAndClearPromise: Promise<void>

  _getItem = async (): Promise<string> => {
    try {
      return await AsyncStorage.getItem('routeState')
    } catch (e) {
      logger.warn('[RouteState] Error getting item:', e)
      throw e
    }
  }

  _setItem = async (item: Object): Promise<void> => {
    logger.info('[RouteState] Setting item:', item)
    const s = JSON.stringify(item)
    try {
      await AsyncStorage.setItem('routeState', s)
    } catch (e) {
      logger.warn('[RouteState] Error setting item:', e)
      throw e
    }
  }

  _removeItem = async (): Promise<void> => {
    logger.info('[RouteState] Removing item')
    try {
      return await AsyncStorage.removeItem('routeState')
    } catch (e) {
      logger.warn('[RouteState] Error removing item:', e)
      throw e
    }
  }

  _getAndClearItem = async (dispatch: Dispatch, getState: GetState): Promise<void> => {
    let s = await this._getItem()

    let item
    try {
      item = JSON.parse(s)
    } catch (e) {
      logger.warn('[RouteState] Error parsing item:', s, e)
      throw e
    }

    // Before we actually nav to the saved routeState, we should clear
    // it for future runs of the app.  That way, if the act of navigating
    // to this route causes a crash for some reason, we won't get stuck
    // in a loop of trying to restore the bad state every time we launch.
    await this._removeItem()

    logger.info('[RouteState] Got item:', item)

    if (!item) {
      return
    }

    if (item.tab) {
      if (item.selectedConversationIDKey) {
        await dispatch(
          ConfigGen.createSetInitialState({
            initialState: {conversation: item.selectedConversationIDKey, tab: chatTab},
          })
        )
      } else {
        await dispatch(ConfigGen.createSetInitialState({initialState: {tab: item.tab}}))
      }
    }
  }

  load = async (dispatch: Dispatch, getState: GetState): Promise<void> => {
    try {
      let url
      try {
        url = await Linking.getInitialURL()
      } catch (e) {
        logger.warn('[RouteState] Error getting initial URL:', e)
      }

      if (url) {
        logger.info('[RouteState] initial URL:', url)
        await dispatch(ConfigGen.createSetInitialState({initialState: {url}}))
      }

      // Make sure that concurrent loads return the same result until
      // the next call to store/clear.
      if (this._getAndClearPromise) {
        logger.info('[RouteState] Using existing getAndClear promise')
      } else {
        logger.info('[RouteState] Creating new getAndClear promise')
        this._getAndClearPromise = this._getAndClearItem(dispatch, getState)
      }

      await this._getAndClearPromise
    } catch (e) {
      console.warn('Error route state loading, ignoring', e)
    }
  }

  store = async (dispatch: Dispatch, getState: GetState): Promise<void> => {
    try {
      const state = getState()
      const routeTree = state.routeTree
      if (!routeTree) {
        logger.info('[RouteState] No routetree')
      }
      if (!routeTree.loggedInUserNavigated) {
        logger.info('[RouteState] Ignoring store before route changed')
      }

      if (this._getAndClearPromise) {
        logger.info('[RouteState] Removing getAndClear promise')
        delete this._getAndClearPromise
      }

      const routeState = routeTree.routeState
      if (!routeState) {
        logger.info('RouteState] No route state')
      }
      const item = {}

      const routePath = getPath(state.routeTree.routeState)
      const selectedTab = routeState.selected
      if (isValidInitialTab(selectedTab)) {
        item.tab = selectedTab
        if (selectedTab === chatTab) {
          if (routePath.size > 1) {
            // in a conversation and not on the inbox
            item.selectedConversationIDKey = state.chat2.selectedConversation
          }
        }
        await this._setItem(item)
      } else {
        // If we have a selected invalid tab, we're most likely signed
        // out. In any case, just clobber the store so we load the
        // default initial tab on the next login.
        logger.info('[RouteState] Invalid initial tab:', selectedTab)
        await this._removeItem()
      }
    } catch (e) {
      console.warn('Error route state store, ignoring', e)
    }
  }

  clear = async (dispatch: Dispatch, getState: GetState): Promise<void> => {
    try {
      const state = getState()
      if (!state.routeTree.loggedInUserNavigated) {
        logger.info('[RouteState] Ignoring clear before route changed')
      }

      if (this._getAndClearPromise) {
        logger.info('[RouteState] Removing getAndClear promise')
        delete this._getAndClearPromise
      }

      await this._removeItem()
    } catch (e) {
      console.warn('Error route state clear, ignoring', e)
    }
  }
}

export {RouteStateStorage}
