// @flow
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as I from 'immutable'
import * as GregorGen from '../../../actions/gregor-gen'
import openURL from '../../../util/open-url'
import {navigateAppend} from '../../../actions/route-tree'
import {type TypedState, connect} from '../../../util/container'
import {Subteams} from '.'

export type OwnProps = {
  teamname: Types.Teamname,
}

const mapStateToProps = (state: TypedState, {teamname}: OwnProps) => ({
  _subteams: state.teams.getIn(['teamNameToSubteams', teamname], I.Set()),
  sawSubteamsBanner: state.teams.getIn(['sawSubteamsBanner'], false),
  yourOperations: Constants.getCanPerform(state, teamname),
})

const mapDispatchToProps = (dispatch: Dispatch, {teamname}: OwnProps) => ({
  onCreateSubteam: () =>
    dispatch(navigateAppend([{props: {makeSubteam: true, name: teamname}, selected: 'showNewTeamDialog'}])),
  onHideSubteamsBanner: () =>
    dispatch(GregorGen.createInjectItem({body: 'true', category: 'sawSubteamsBanner'})),
  onReadMoreAboutSubteams: () => openURL('https://keybase.io/docs/teams/design'),
})

const listMergeProps = (stateProps, dispatchProps, ownProps) => {
  const subteams = stateProps._subteams.sort()
  const noSubteams = subteams.isEmpty()
  const listItems = [
    ...(!stateProps.sawSubteamsBanner
      ? [
          {
            type: 'subteam',
            key: 'intro',
            onHideSubteamsBanner: dispatchProps.onHideSubteamsBanner,
            onReadMore: dispatchProps.onReadMoreAboutSubteams,
            teamname: ownProps.teamname,
            subtype: 'intro',
          },
        ]
      : []),
    ...(stateProps.yourOperations.manageSubteams
      ? [
          {
            type: 'subteam',
            key: 'addSubteam',
            subtype: 'addSubteam',
            onCreateSubteam: dispatchProps.onCreateSubteam,
          },
        ]
      : []),
    ...subteams.map(subteam => ({type: 'subteam', key: subteam, teamname: subteam, subtype: 'subteam'})),
    ...(noSubteams ? [{type: 'subteam', key: 'noSubteams', subtype: 'noSubteams'}] : []),
  ]
  return {listItems}
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  listItems: listMergeProps(stateProps, dispatchProps, ownProps).listItems,
  ...ownProps,
})

export const subteamsListItemsConnector = connect(mapStateToProps, mapDispatchToProps, mergeProps)
export default subteamsListItemsConnector(Subteams)
