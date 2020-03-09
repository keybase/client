import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import {ModalTitle} from '../../common'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Types from '../../../constants/types/teams'

const TeamPurpose = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onSubmit = (teamType: Types.TeamWizardTeamType) =>
    dispatch(TeamsGen.createSetTeamWizardTeamType({teamType}))

  return (
    <Kb.Modal
      onClose={onBack}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamname="" title="New team" />,
      }}
      allowOverflow={true}
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={Styles.isMobile ? 'xsmall' : 'tiny'}
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

const styles = Styles.styleSheetCreate(() => ({
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.blueGrey,
      borderRadius: 4,
    },
    isElectron: {minHeight: 420},
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Styles.globalMargins.small,
  },
  wordBreak: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default TeamPurpose
