import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {ModalTitle} from '@/teams/common'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useTeamsState} from '@/stores/teams'

const MakeBigTeam = () => {
  const nav = useSafeNavigation()
  const onBack = () => nav.safeNavigateUp()
  const setTeamWizardTeamSize = useTeamsState(s => s.dispatch.setTeamWizardTeamSize)
  const onSubmit = (isBig: boolean) => setTeamWizardTeamSize(isBig)

  const teamID = T.Teams.newTeamWizardTeamID

  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamID={teamID} title="Make it a big team?" />,
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
        <Kb.RichButton
          description="With multiple roles and channels. Big team chats appear in the lower section in the inbox."
          icon="icon-teams-size-big-64"
          onClick={() => onSubmit(true)}
          title="Yes, make it a big team"
        />

        <Kb.RichButton
          description="You can always make it a big team later."
          icon="icon-teams-size-small-64"
          onClick={() => onSubmit(false)}
          title="No, keep it a simple conversation for now"
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  bg: {backgroundColor: Kb.Styles.globalColors.blueGrey},
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
}))

export default MakeBigTeam
