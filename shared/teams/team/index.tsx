import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import TeamTabs from './tabs/container'
import {Row} from './rows'
import renderRow from './rows/render'
import {TeamDetailsSubscriber, TeamsSubscriber} from '../subscriber'
import SelectionPopup from './selection-popup'
import flags from '../../util/feature-flags'
export type Sections = Array<{data: Array<Row>; header?: Row; key: string}>

export type Props = {
  teamID: Types.TeamID
  selectedTab: Types.TabKey
  sections: Sections
  setSelectedTab: (arg0: Types.TabKey) => void
}

const Team = props => {
  const renderItem = ({item}: {item: Row}) => {
    switch (item.type) {
      case 'tabs':
        return (
          <TeamTabs
            teamID={props.teamID}
            selectedTab={props.selectedTab}
            setSelectedTab={props.setSelectedTab}
          />
        )
      case 'settings':
      case 'header':
      case 'divider':
      case 'member':
      case 'bot':
      case 'bot-add':
      case 'channel':
      case 'channel-header':
      case 'channel-footer':
      case 'invites-invite':
      case 'invites-request':
      case 'invites-divider':
      case 'invites-none':
      case 'subteam-intro':
      case 'subteam-add':
      case 'subteam-none':
      case 'subteam-subteam':
      case 'subteam-info':
      case 'loading':
        return renderRow(item, props.teamID)
      default: {
        throw new Error(`Impossible case encountered in team page list: ${item}`)
      }
    }
  }

  const renderSectionHeader = ({section}) => (section.header ? renderItem({item: section.header}) : null)

  const SectionList = Styles.isMobile ? Kb.ReAnimated.createAnimatedComponent(Kb.SectionList) : Kb.SectionList
  const offset = Styles.isMobile ? new Kb.ReAnimated.Value(0) : undefined
  const onScroll = Styles.isMobile
    ? Kb.ReAnimated.event([{nativeEvent: {contentOffset: {y: offset}}}], {useNativeDriver: true})
    : undefined

  return (
    <Kb.Box style={styles.container}>
      <TeamsSubscriber />
      <TeamDetailsSubscriber teamID={props.teamID} />
      {Styles.isMobile && flags.teamsRedesign && <MobileHeader teamID={props.teamID} offset={offset} />}
      <SectionList
        alwaysVounceVertical={false}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={true}
        sections={props.sections}
        style={Styles.collapseStyles([styles.list, flags.teamsRedesign && styles.listTeamsRedesign])}
        contentContainerStyle={styles.listContentContainer}
        onScroll={onScroll}
      />
      <SelectionPopup selectedTab={props.selectedTab} teamID={props.teamID} />
    </Kb.Box>
  )
}

const startAnimationOffset = 40
const MobileHeader = ({teamID, offset}: {teamID: Types.TeamID; offset: any}) => {
  const meta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const AnimatedBox2 = Kb.ReAnimated.createAnimatedComponent(Kb.Box2)
  const top = Kb.ReAnimated.interpolate(offset, {
    inputRange: [-9999, startAnimationOffset, startAnimationOffset + 40, 99999999],
    outputRange: [40, 40, 0, 0],
  })
  const opacity = Kb.ReAnimated.interpolate(offset, {
    inputRange: [-9999, 0, 1, 9999],
    outputRange: [0, 0, 1, 1],
  })
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" style={styles.header}>
      <AnimatedBox2
        style={[styles.smallHeader, {opacity, top}]}
        gap="tiny"
        direction="horizontal"
        centerChildren={true}
        fullWidth={true}
        fullHeight={true}
      >
        <Kb.Avatar size={16} teamname={meta.teamname} />
        <Kb.Text type="BodyBig" lineClamp={1} ellipsizeMode="middle">
          {meta.teamname}
        </Kb.Text>
      </AnimatedBox2>
      <Kb.BackButton onClick={onBack} style={styles.backButton} />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  backButton: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  header: {height: 40, left: 0, position: 'absolute', right: 0, top: 0},
  list: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
    },
    isMobile: {
      ...Styles.globalStyles.fillAbsolute,
    },
  }),
  listContentContainer: Styles.platformStyles({
    isMobile: {
      display: 'flex',
      flexGrow: 1,
    },
  }),
  listTeamsRedesign: Styles.platformStyles({isMobile: {top: 40}}),
  smallHeader: {
    ...Styles.padding(0, Styles.globalMargins.xlarge),
  },
}))

export default Team
