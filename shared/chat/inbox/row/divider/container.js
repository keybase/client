// @flow
import {Divider} from '.'
import {createSelector, connect, type TypedState} from '../../../../util/container'

const getBadges = (state: TypedState) => state.entities.get('inboxUnreadCountBadge')
const getOwnProps = (_, {smallIDsHidden}) => ({smallIDsHidden})

const dividerSelector = createSelector([getBadges, getOwnProps], (badges, ownProps) => {
  const badgeCount = (ownProps.smallIDsHidden || []).reduce((total, id) => {
    return total + badges.get(id, 0)
  }, 0)

  return {
    badgeCount,
    hiddenCount: ownProps.smallIDsHidden.length,
  }
})

export default connect(dividerSelector)(Divider)
