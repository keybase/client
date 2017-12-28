// @flow
import {FloatingDivider} from '.'
import {createSelector, connect, type TypedState} from '../../../../util/container'

const getMetaMap = (state: TypedState) => state.chat2.metaMap
const getBadges = (state: TypedState) => state.chat2.badgeMap

const floatinDividerSelector = createSelector([getBadges, getMetaMap], (badgeMap, metaMap) => {
  const badgeCount = metaMap
    .filter(meta => meta.teamType === 'big')
    .reduce((total, map, id) => total + badgeMap.get(id, 0), 0)

  return {badgeCount}
})

export default connect(floatinDividerSelector)(FloatingDivider)
