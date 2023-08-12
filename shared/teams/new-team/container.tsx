import * as C from '../../constants'
import NewTeamDialog from '.'
import upperFirst from 'lodash/upperFirst'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'

type OwnProps = {subteamOf?: Types.TeamID}

export default (ownProps: OwnProps) => {
  const subteamOf = ownProps.subteamOf ?? Types.noTeamID
  const baseTeam = C.useTeamsState(s => Constants.getTeamMeta(s, subteamOf).teamname)
  const errorText = C.useTeamsState(s => upperFirst(s.errorInTeamCreation))
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const resetErrorInTeamCreation = C.useTeamsState(s => s.dispatch.resetErrorInTeamCreation)
  const createNewTeam = C.useTeamsState(s => s.dispatch.createNewTeam)
  const onClearError = resetErrorInTeamCreation
  const onSubmit = (teamname: string, joinSubteam: boolean) => {
    createNewTeam(teamname, joinSubteam)
  }
  const props = {
    baseTeam,
    errorText,
    onCancel,
    onClearError,
    onSubmit,
    subteamOf,
  }
  return <NewTeamDialog {...props} />
}
