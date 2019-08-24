import {BigTeamsDivider} from '.'
import {connect} from '../../../../util/container'
import {memoize} from '../../../../util/memoize'

type OwnProps = {
  toggle: () => void
}

const getBadgeCount = memoize((metaMap, badgeMap) =>
  metaMap.filter(meta => meta.teamType === 'big').reduce((total, _, id) => total + badgeMap.get(id, 0), 0)
)

const mapStateToProps = state => ({
  badgeCount: getBadgeCount(state.chat2.metaMap, state.chat2.badgeMap),
})

const mergeProps = (stateProps, _, ownProps: OwnProps) => ({
  badgeCount: stateProps.badgeCount,
  toggle: ownProps.toggle,
})

export default connect(
  mapStateToProps,
  () => ({}),
  mergeProps
)(BigTeamsDivider)
