import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {makeNewTeamWizard, type NewTeamWizard} from './state'
import * as C from '@/constants'
import {useNavigation} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'

type Props = {
  wizard?: NewTeamWizard
}

type TeamWizard1TeamPurposeParamList = {
  teamWizard1TeamPurpose: {wizard?: NewTeamWizard}
}

const TeamPurpose = ({wizard: wizardParam}: Props) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<TeamWizard1TeamPurposeParamList, 'teamWizard1TeamPurpose'>>()
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

export default TeamPurpose
