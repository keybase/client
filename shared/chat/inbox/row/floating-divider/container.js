// @flow
import {FloatingDivider} from '.'
import {createSelector, connect, type TypedState} from '../../../../util/container'

const getInboxBigChannels = (state: TypedState) => state.entities.get('inboxBigChannels')
const getBadges = (state: TypedState) => state.entities.get('inboxUnreadCountBadge')

const floatinDividerSelector = createSelector(
  [getBadges, getInboxBigChannels],
  (badges, inboxBigChannels) => {
    const badgeCount = inboxBigChannels.reduce((total, _, id) => {
      return total + badges.get(id, 0)
    }, 0)

    return {badgeCount}
  }
)

export default connect(floatinDividerSelector)(FloatingDivider)
