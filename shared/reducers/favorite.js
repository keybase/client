// @flow
import * as Constants from '../constants/favorite'
import * as CommonConstants from '../constants/common'
import _ from 'lodash'
import type {Folder} from '../constants/types/flow-types'
import type {FavoriteAction} from '../constants/favorite'
import type {Props} from '../folders/render'
import {canonicalizeUsernames, parseFolderNameToUsers} from '../util/kbfs'

type State = {
  folders: ?Props
}

const initialState = {
  folders: null
}

const folderToProps = (folders: Array<Folder>, username: string = '') => { // eslint-disable-line space-infix-ops
  const converted = folders.map(f => {
    const users = canonicalizeUsernames(username, parseFolderNameToUsers(f.name))
      .map(u => ({
        username: u,
        you: u === username,
        broken: false
      }))

    const groupAvatar = f.private ? (users.length > 2) : (users.length > 1)
    const userAvatar = groupAvatar ? null : users[users.length - 1].username

    return {
      users,
      isPublic: !f.private,
      groupAvatar,
      userAvatar
    }
  })

  const [priv, pub] = _.partition(converted, {isPublic: false})

  return {
    privateBadge: 0,
    publicBadge: 0,
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

export default function (state: State = initialState, action: FavoriteAction): State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case Constants.favoriteList:
      return {
        ...state,
        folders: action.payload && folderToProps(action.payload.folders, action.payload.currentUser || '')
      }
    default:
      return state
  }
}
