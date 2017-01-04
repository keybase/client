// @flow
import {globalColors} from '../../../styles'
import {Map} from 'immutable'

import type {FollowingMap, MetaDataMap} from '../../../constants/chat'

const marginColor = (user: string, you: string, followingMap: FollowingMap, metaDataMap: MetaDataMap) => {
  if (user === you) {
    return globalColors.white
  } else {
    if (metaDataMap.get(user, Map()).get('brokenTracker', false)) {
      return globalColors.red
    }
    return followingMap[user] ? globalColors.green2 : globalColors.blue
  }
}

const colorForAuthor = (user: string, you: string, followingMap: FollowingMap, metaDataMap: MetaDataMap) => {
  if (user === you) {
    return globalColors.black_75
  } else {
    return marginColor(user, you, followingMap, metaDataMap)
  }
}

export {
  marginColor,
  colorForAuthor,
}
