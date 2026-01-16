import * as Kb from '@/common-adapters'
import {ModalTitle} from '@/teams/common'
import * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useTeamsState} from '@/stores/teams'

const TeamPurpose = () => {
  const nav = useSafeNavigation()
  const onBack = () => nav.safeNavigateUp()
  const setTeamWizardTeamType = useTeamsState(s => s.dispatch.setTeamWizardTeamType)
  const onSubmit = (teamType: T.Teams.TeamWizardTeamType) => setTeamWizardTeamType(teamType)

  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={onBack}
      header={{
        leftButton: Kb.Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onBack}>
            Cancel
          </Kb.Text>
        ) : undefined,
        title: <ModalTitle teamID={T.Teams.noTeamID} title="New team" />,
      }}
      allowOverflow={true}
      backgroundStyle={styles.bg}
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={Kb.Styles.isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.Text type="BodySemibold">What do you need a team for?</Kb.Text>
        <Kb.RichButton
          description="A small group of people, with no initial need for channels."
          icon="icon-teams-type-squad-64"
          onClick={() => onSubmit('friends')}
          title="Friends, family, or squad"
        />

        <Kb.RichButton
          description="With multiple roles and channels."
          icon="icon-teams-type-business-64"
          onClick={() => onSubmit('project')}
          title="A project, business or organization"
        />

        <Kb.RichButton
          description="A forum for people who share an interest or cause."
          icon="icon-teams-type-community-64"
          onClick={() => onSubmit('community')}
          title="A community"
        />

        <Kb.RichButton
          description="Start simple and go from there."
          icon="icon-teams-type-notsure-64"
          onClick={() => onSubmit('other')}
          title="Other/You're not sure"
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  bg: Kb.Styles.platformStyles({
    common: {backgroundColor: Kb.Styles.globalColors.blueGrey},
    isElectron: {borderRadius: 4},
  }),
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Kb.Styles.globalMargins.small,
  },
  wordBreak: Kb.Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default TeamPurpose
