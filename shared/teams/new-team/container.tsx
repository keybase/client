import * as RouterConstants from '../../constants/router2'
import NewTeamDialog from '.'
import upperFirst from 'lodash/upperFirst'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'

type OwnProps = {subteamOf?: Types.TeamID}

export default (ownProps: OwnProps) => {
  const subteamOf = ownProps.subteamOf ?? Types.noTeamID
  const baseTeam = Constants.useState(s => Constants.getTeamMeta(s, subteamOf).teamname)
  const errorText = Constants.useState(s => upperFirst(s.errorInTeamCreation))
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const resetErrorInTeamCreation = Constants.useState(s => s.dispatch.resetErrorInTeamCreation)
  const createNewTeam = Constants.useState(s => s.dispatch.createNewTeam)
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
