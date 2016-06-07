/* @flow */

import engine from '../engine'
import * as Constants from '../constants/favorite'
import {badgeApp} from './notifications'
import {canonicalizeUsernames, parseFolderNameToUsers} from '../util/kbfs'
import _ from 'lodash'
import type {Folder, favoriteFavoriteListRpc} from '../constants/types/flow-types'
import type {Dispatch} from '../constants/types/flux'
import type {FavoriteList} from '../constants/favorite'
import type {Props as FolderProps} from '../folders/render'
import flags from '../util/feature-flags'

const folderToProps = (dispatch: Dispatch, folders: Array<Folder>, username: string = ''): FolderProps => { // eslint-disable-line space-infix-ops
  let privateBadge = 0
  let publicBadge = 0

  const converted = folders.map(f => {
    const users = canonicalizeUsernames(username, parseFolderNameToUsers(f.name))
      .map(u => ({
        username: u,
        you: u === username,
        broken: false
      }))
    const sortName = users.map(u => u.username).join(',')
    const path = `/keybase/${f.private ? 'private' : 'public'}/${sortName}`

    const groupAvatar = f.private ? (users.length > 2) : (users.length > 1)
    const userAvatar = groupAvatar ? null : users[users.length - 1].username
    const meta = null
    // const meta = (__DEV__ && Math.random() < 0.2) ? 'new' : null // uncomment to test seeing new before we integrate fully

    if (meta === 'new') {
      if (f.private) {
        privateBadge++
      } else {
        publicBadge++
      }
    }

    return {
      path,
      users,
      sortName,
      isPublic: !f.private,
      groupAvatar,
      userAvatar,
      onRekey: null,
      meta
    }
  }).sort((a, b) => {
    // New first
    if (a.meta !== b.meta) {
      if (a.meta === 'new') return -1
      if (b.meta === 'new') return 1
    }

    // You next
    if (a.sortName === username) return -1
    if (b.sortName === username) return 1

    return a.sortName.localeCompare(b.sortName)
  })

  const [priv, pub] = _.partition(converted, {isPublic: false})

  return {
    onRekey: () => {},
    smallMode: false,
    showComingSoon: !flags.tabFoldersEnabled,
    privateBadge,
    publicBadge,
    private: {
      tlfs: priv,
      isPublic: false
    },
    public: {
      tlfs: pub,
      isPublic: true
    }
  }
}

export function favoriteList (): (dispatch: Dispatch) => void {
  return (dispatch, getState) => {
    const params : favoriteFavoriteListRpc = {
      param: {},
      incomingCallMap: {},
      method: 'favorite.favoriteList',
      callback: (error, folders: Array<Folder>) => {
        if (error) {
          console.warn('Err in favorite.favoriteList', error)
          return
        }

        if (!folders) {
          folders = []
        }

        const config = getState && getState().config
        const currentUser = config && config.username
        const loggedIn = config && config.loggedIn

        // Ensure private/public folders exist for us
        if (currentUser && loggedIn) {
          [true, false].forEach(isPrivate => {
            const idx = folders.findIndex(f => f.name === currentUser && f.private === isPrivate)
            let toAdd = {name: currentUser, private: isPrivate, notificationsOn: false, created: false}

            if (idx !== -1) {
              toAdd = folders[idx]
              folders.splice(idx, 1)
            }

            folders.unshift(toAdd)
          })
        }

        const folderProps = folderToProps(dispatch, folders, currentUser)
        const action: FavoriteList = {type: Constants.favoriteList, payload: {folders: folderProps}}
        dispatch(action)
        dispatch(badgeApp('newTLFs', !!(folderProps.publicBadge || folderProps.privateBadge)))
      }
    }
    engine.rpc(params)
  }
}
