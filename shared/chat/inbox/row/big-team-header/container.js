// @flow
import {connect, type TypedState} from '../../../../util/container'
import {getTeamMemberCount} from '../../../../constants/teams'
import {BigTeamHeader} from '.'
// Typically you'd use the navigateAppend from the routeable component but this is a child* of that
// and I'd prefer not to plumb through anything that could cause render thrashing so using the
// global one here
import {navigateAppend} from '../../../../actions/route-tree'

const mapStateToProps = (state: TypedState, {teamname}) => ({
  memberCount: getTeamMemberCount(state, teamname),
  teamname,
})

const mapDispatchToProps = (dispatch, {teamname}) => ({
  onClickGear: (evt?: SyntheticEvent<Element>) =>
    dispatch(
      navigateAppend([
        {
          props: {
            teamname,
            isSmallTeam: false,
            position: 'bottom right',
            targetRect: evt && evt.currentTarget.getBoundingClientRect(),
          },
          selected: 'infoPanelMenu',
        },
      ])
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...dispatchProps,
  memberCount: stateProps.memberCount,
  teamname: stateProps.teamname,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(BigTeamHeader)
