// @flow
import {Divider} from '.'
import * as Types from '../../../../constants/types/chat2'
import {createSelector, connect, type TypedState} from '../../../../util/container'
import type {StylesCrossPlatform} from '../../../../styles'

type OwnProps = {
  showButton: boolean,
  toggle: () => void,
  smallIDsHidden: Array<Types.ConversationIDKey>,
  style: StylesCrossPlatform,
}

const getBadges = (state: TypedState) => state.chat2.get('badgeMap')
const getOwnProps = (_, {smallIDsHidden}: OwnProps) => ({smallIDsHidden})

const dividerSelector = createSelector([getBadges, getOwnProps], (badgeMap, ownProps) => {
  const badgeCount = (ownProps.smallIDsHidden || []).reduce((total, id) => total + badgeMap.get(id, 0), 0)

  return {
    badgeCount,
    hiddenCount: ownProps.smallIDsHidden.length,
  }
})

export default connect(dividerSelector)(Divider)
