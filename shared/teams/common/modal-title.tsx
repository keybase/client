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
  const avatarFilepath = isNewTeamWizard ? newTeamWizard?.avatarFilename : undefined
  const avatarCrop = isNewTeamWizard ? newTeamWizard?.avatarCrop : undefined

  return isMobile ? (
    <Kb.Box2 direction="vertical" alignItems="center">
      {!!displayTeamname && (
        <Kb.Text type="BodyTiny" lineClamp={1} ellipsizeMode="middle">
          {displayTeamname}
        </Kb.Text>
      )}
      <Kb.Text type="BodyBig">{title}</Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" gap="xtiny" alignItems="center" style={styles.title}>
      <Kb.Avatar
        size={32}
        teamname={displayTeamname === 'New team' ? '' : displayTeamname}
        style={styles.avatar}
        isTeam={true}
        imageOverrideUrl={isNewTeamWizard ? avatarFilepath : undefined}
        crop={isNewTeamWizard ? avatarCrop : undefined}
      />
      <Kb.Text type="BodySmall" lineClamp={1}>
        {displayTeamname}
      </Kb.Text>
      <Kb.Text type="Header">{title}</Kb.Text>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  avatar: Kb.Styles.platformStyles({
    isElectron: {
      height: 16,
      position: 'relative',
      top: -16,
    },
  }),
  title: {
    paddingBottom: Kb.Styles.globalMargins.tiny,
  },
}))

export default ModalTitle
