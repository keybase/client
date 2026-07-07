import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {newTeamWizardToAddMembersWizard, type NewTeamWizard} from './state'
import CardChoice from '../../common/card-choice'
import {useNavigation} from '@react-navigation/native'

type Props = {
  wizard: NewTeamWizard
}

const MakeBigTeam = ({wizard: initialWizard}: Props) => {
  const navigation = useNavigation('teamWizard4TeamSize')
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
        <CardChoice
          icon="icon-teams-size-big-64"
          title="Yes, make it a big team"
          subtitle="With multiple roles and channels. Big team chats appear in the lower section in the inbox."
          onClick={() => onSubmit(true)}
        />
        <CardChoice
          icon="icon-teams-size-small-64"
          title="No, keep it a simple conversation for now"
          subtitle="You can always make it a big team later."
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
