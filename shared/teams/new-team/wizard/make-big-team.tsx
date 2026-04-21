import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {newTeamWizardToAddMembersWizard, type NewTeamWizard} from './state'

type Props = {
  navigation: {setParams: (params: {wizard: NewTeamWizard}) => void}
  route: {params: {wizard: NewTeamWizard}}
}

const MakeBigTeam = ({navigation, route}: Props) => {
  const navigateAppend = C.Router2.navigateAppend
  const onSubmit = (isBig: boolean) => {
    const wizard = {...route.params.wizard, isBig}
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
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
}))

export default MakeBigTeam
