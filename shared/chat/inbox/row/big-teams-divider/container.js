// @flow
import {BigTeamsDivider} from '.'
import {connect} from '../../../../util/container'

const mapStateToProps = state => ({
  _badges: state.chat2.badgeMap,
  _metaMap: state.chat2.metaMap,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeCount: stateProps._metaMap
    .filter(meta => meta.teamType === 'big')
    .reduce((total, map, id) => total + stateProps._badges.get(id, 0), 0),
  toggle: ownProps.toggle,
})

export default connect<OwnProps, _,_,_,_>(
  mapStateToProps,
  () => ({}),
  mergeProps
)(BigTeamsDivider)
