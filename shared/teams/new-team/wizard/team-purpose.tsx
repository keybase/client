import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {makeNewTeamWizard, type NewTeamWizard} from './state'
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
        <Kb.ListItem
          type="Card"
          firstItem={true}
          icon={<Kb.IconAuto type="icon-teams-type-squad-64" />}
          body={<Kb.Box2 direction="vertical" fullWidth={true}><Kb.Text type="BodySemibold">Friends, family, or squad</Kb.Text><Kb.Text type="BodySmall">A small group of people, with no initial need for channels.</Kb.Text></Kb.Box2>}
          onClick={() => onSubmit('friends')}
        />
        <Kb.ListItem
          type="Card"
          firstItem={true}
          icon={<Kb.IconAuto type="icon-teams-type-business-64" />}
          body={<Kb.Box2 direction="vertical" fullWidth={true}><Kb.Text type="BodySemibold">A project, business or organization</Kb.Text><Kb.Text type="BodySmall">With multiple roles and channels.</Kb.Text></Kb.Box2>}
          onClick={() => onSubmit('project')}
        />
        <Kb.ListItem
          type="Card"
          firstItem={true}
          icon={<Kb.IconAuto type="icon-teams-type-community-64" />}
          body={<Kb.Box2 direction="vertical" fullWidth={true}><Kb.Text type="BodySemibold">A community</Kb.Text><Kb.Text type="BodySmall">A forum for people who share an interest or cause.</Kb.Text></Kb.Box2>}
          onClick={() => onSubmit('community')}
        />
        <Kb.ListItem
          type="Card"
          firstItem={true}
          icon={<Kb.IconAuto type="icon-teams-type-notsure-64" />}
          body={<Kb.Box2 direction="vertical" fullWidth={true}><Kb.Text type="BodySemibold">{"Other/You're not sure"}</Kb.Text><Kb.Text type="BodySmall">Start simple and go from there.</Kb.Text></Kb.Box2>}
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
