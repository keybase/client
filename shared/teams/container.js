// @flow
import Teams from '.'
import pausableConnect from '../util/pausable-connect'
import openURL from '../util/open-url'

type DispatchProps = {
  onCreateTeam: () => void,
  onJoinTeam: () => void,
  onReadMore: () => void,
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
  onReadMore: () => {
    openURL('https://keybase.io/blog/introducing-keybase-teams')
  },
  onHideBanner: () => {
    // TODO: Need a way to store this from CORE
    console.log('onHideBanner not implemented yet')
  },
})

export default pausableConnect(null, mapDispatchToProps)(Teams)
