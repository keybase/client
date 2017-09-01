// @flow
import Render from './render'
import pausableConnect from '../util/pausable-connect'
import openURL from '../util/open-url'

const mapStateToProps = state => ({})

type DispatchProps = {
  onCreateTeam: () => void,
  onJoinTeam: () => void,
  onReadDoc: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
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

const mergeProps = (stateProps, dispatchProps: DispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(Render)
