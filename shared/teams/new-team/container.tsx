import * as C from '@/constants'
import * as T from '@/constants/types'
import NewTeamDialog from '.'
import upperFirst from 'lodash/upperFirst'

type OwnProps = {subteamOf?: T.Teams.TeamID}

const Container = (ownProps: OwnProps) => {
  const subteamOf = ownProps.subteamOf ?? T.Teams.noTeamID
  const baseTeam = C.useTeamsState(s => C.Teams.getTeamMeta(s, subteamOf).teamname)
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

export default Container
