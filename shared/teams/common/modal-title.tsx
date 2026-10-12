import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useLoadedTeam} from '@/teams/team/use-loaded-team'

type Props = {
  title: string
  teamID: T.Teams.TeamID
  newTeamWizard?: T.Teams.NewTeamWizardState
}

export const ModalTitle = ({title, teamID, newTeamWizard}: Props) => {
  const {teamMeta} = useLoadedTeam(teamID)
  const teamname = teamMeta.teamname
  const isNewTeamWizard = teamID === T.Teams.newTeamWizardTeamID
  const displayTeamname = isNewTeamWizard ? (newTeamWizard?.name || 'New team') : teamname
  const avatar = isMobile ? undefined : (
    <Kb.Avatar
      size={16}
      teamname={displayTeamname === 'New team' ? '' : displayTeamname}
      isTeam={true}
      imageOverrideUrl={isNewTeamWizard ? newTeamWizard?.avatarFilename : undefined}
      crop={isNewTeamWizard ? newTeamWizard?.avatarCrop : undefined}
    />
  )
  return <Kb.ModalHeaderTitle title={title} subtitle={displayTeamname} avatar={avatar} />
}

export default ModalTitle
