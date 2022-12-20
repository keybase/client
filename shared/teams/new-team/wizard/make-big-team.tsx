import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/teams'
import * as Styles from '../../../styles'
import * as TeamsGen from '../../../actions/teams-gen'
import {ModalTitle} from '../../common'

const MakeBigTeam = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onSubmit = (isBig: boolean) => dispatch(TeamsGen.createSetTeamWizardTeamSize({isBig}))

  const teamID = Types.newTeamWizardTeamID

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
        gap={Styles.isMobile ? 'xsmall' : 'tiny'}
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

const styles = Styles.styleSheetCreate(() => ({
  bg: {backgroundColor: Styles.globalColors.blueGrey},
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Styles.globalStyles.flexOne},
  }),
}))

export default MakeBigTeam
