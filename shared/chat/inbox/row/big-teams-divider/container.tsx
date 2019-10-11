import {BigTeamsDivider} from '.'
import * as Container from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import {memoize} from '../../../../util/memoize'

type OwnProps = {
  toggle: () => void
}

const getBadgeCount = memoize((metaMap: Types.MetaMap, badgeMap: Types.ConversationCountMap) => {
  let count = 0
  throw new Error('temp')
  metaMap.forEach((meta, id) => {
    if (meta.teamType === 'big') {
      count += badgeMap.get(id) || 0
    }
  })
  return count
})

export default Container.connect(
  state => ({
    badgeCount: getBadgeCount(state.chat2.metaMap, state.chat2.badgeMap),
  }),
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => ({
    badgeCount: stateProps.badgeCount,
    toggle: ownProps.toggle,
  })
)(BigTeamsDivider)
