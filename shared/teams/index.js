// @flow
import Render from './render'
import pausableConnect from '../util/pausable-connect'
import openURL from '../util/open-url'

import type {TypedState} from '../constants/reducer'

type StateProps = {
  teams: Array<{name: string}>,
}

const mapStateToProps = (state: TypedState): StateProps => {
  // TODO: Figure out better way to get list of teams -- this won't
  // work until the inbox is loaded.
  const inbox = state.chat.get('inbox')
  const teams = {}
  inbox.forEach(i => {
    if (i.teamname) {
      teams[i.teamname] = {}
    }
  })
  let teamNames = Object.keys(teams)
  // TODO: Sort case-insensitively?
  teamNames.sort()
  return {
    teams: teamNames.map(name => ({name})),
  }
}

type DispatchProps = {
  onCreateTeam: () => void,
  onJoinTeam: () => void,
  onReadDoc: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  onCreateTeam: () => {
    // TODO: Hook this up. Need to change onShowNewTeamDialog to
    // make its conversationIDKey parameter optional first.
    console.log('onCreateTeam not implemented yet')
  },
  onJoinTeam: () => {
    // TODO: Hook this up once we have a join team dialog.
    console.log('onJoinTeam not implemented yet')
  },
  onReadDoc: () => {
    openURL('https://keybase.io/docs/command_line/teams_alpha')
  },
})

export default pausableConnect(mapStateToProps, mapDispatchToProps)(Render)
