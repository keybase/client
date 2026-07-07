import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {makeNewTeamWizard, type NewTeamWizard} from './state'
import CardChoice from '../../common/card-choice'
import * as C from '@/constants'
import {useNavigation} from '@react-navigation/native'

type Props = {
  wizard?: NewTeamWizard
}

const TeamPurpose = ({wizard: wizardParam}: Props) => {
  const navigation = useNavigation('teamWizard1TeamPurpose')
  const navigateAppend = C.Router2.navigateAppend
  const wizard = wizardParam ?? makeNewTeamWizard()
  const onSubmit = (teamType: T.Teams.TeamWizardTeamType) => {
    const nextWizard = {...wizard, teamType}
    navigation.setParams({wizard: nextWizard})
    navigateAppend({name: 'teamWizard2TeamInfo', params: {wizard: nextWizard}})
  }

  return (
    <>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.Text type="BodySemibold">What do you need a team for?</Kb.Text>
        <CardChoice
          icon="icon-teams-type-squad-64"
          title="Friends, family, or squad"
          subtitle="A small group of people, with no initial need for channels."
          onClick={() => onSubmit('friends')}
        />
        <CardChoice
          icon="icon-teams-type-business-64"
          title="A project, business or organization"
          subtitle="With multiple roles and channels."
          onClick={() => onSubmit('project')}
        />
        <CardChoice
          icon="icon-teams-type-community-64"
          title="A community"
          subtitle="A forum for people who share an interest or cause."
          onClick={() => onSubmit('community')}
        />
        <CardChoice
          icon="icon-teams-type-notsure-64"
          title="Other/You're not sure"
          subtitle="Start simple and go from there."
          onClick={() => onSubmit('other')}
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

export default TeamPurpose
