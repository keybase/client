import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {newTeamWizardToAddMembersWizard, type NewTeamWizard} from './state'
import {useTypedNavigation} from '@/util/typed-navigation'

type Props = {
  wizard: NewTeamWizard
}

const MakeBigTeam = ({wizard: initialWizard}: Props) => {
  const navigation = useTypedNavigation('teamWizard4TeamSize')
  const navigateAppend = C.Router2.navigateAppend
  const onSubmit = (isBig: boolean) => {
    const wizard = {...initialWizard, isBig}
    navigation.setParams({wizard})
    if (isBig) {
      navigateAppend({name: 'teamWizard5Channels', params: {wizard}})
    } else {
      navigateAppend({
        name: 'teamAddToTeamFromWhere',
        params: {wizard: newTeamWizardToAddMembersWizard(wizard)},
      })
    }
  }

  return (
    <>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.ListItem
          type="Card"
          firstItem={true}
          icon={<Kb.IconAuto type="icon-teams-size-big-64" />}
          body={<Kb.Box2 direction="vertical" fullWidth={true}><Kb.Text type="BodySemibold">Yes, make it a big team</Kb.Text><Kb.Text type="BodySmall">With multiple roles and channels. Big team chats appear in the lower section in the inbox.</Kb.Text></Kb.Box2>}
          onClick={() => onSubmit(true)}
        />
        <Kb.ListItem
          type="Card"
          firstItem={true}
          icon={<Kb.IconAuto type="icon-teams-size-small-64" />}
          body={<Kb.Box2 direction="vertical" fullWidth={true}><Kb.Text type="BodySemibold">No, keep it a simple conversation for now</Kb.Text><Kb.Text type="BodySmall">You can always make it a big team later.</Kb.Text></Kb.Box2>}
          onClick={() => onSubmit(false)}
        />
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      borderRadius: Kb.Styles.borderRadius,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
}))

export default MakeBigTeam
