// @flow
import {Divider} from '.'
import {createSelector, connect, type TypedState} from '../../../../util/container'

const getBadges = (state: TypedState) => state.chat2.get('badgeMap')
const getOwnProps = (_, {smallIDsHidden}) => ({smallIDsHidden})

const dividerSelector = createSelector([getBadges, getOwnProps], (badgeMap, ownProps) => {
  const badgeCount = (ownProps.smallIDsHidden || []).reduce((total, id) => total + badgeMap.get(id, 0), 0)

  return {
    badgeCount,
    hiddenCount: ownProps.smallIDsHidden.length,
  }
})

export default connect(dividerSelector)(Divider)
