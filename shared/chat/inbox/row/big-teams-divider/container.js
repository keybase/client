// @flow
import {BigTeamsDivider} from '.'
import {connect} from '../../../../util/container'

const mapStateToProps = (state) => ({
  _metaMap: state.chat2.metaMap,
  _badges: state.chat2.badgeMap
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeCount : stateProps._metaMap
    .filter(meta => meta.teamType === 'big')
    .reduce((total, map, id) => total + stateProps._badges.get(id, 0), 0),
  toggle: ownProps.toggle,
})

export default connect(mapStateToProps, () => ({}), mergeProps)(BigTeamsDivider)
