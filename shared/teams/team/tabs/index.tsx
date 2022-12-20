import type * as Types from '../../../constants/types/teams'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type {Tab as TabType} from '../../../common-adapters/tabs'

type TeamTabsProps = {
  admin: boolean
  error?: string
  isBig: boolean
  loading: boolean
  newRequests: number
  numInvites: number
  numRequests: number
  numSubteams: number
  resetUserCount: number
  selectedTab?: Types.TabKey
  setSelectedTab: (arg0: Types.TabKey) => void
  showSubteams: boolean
}

const TeamTabs = (props: TeamTabsProps) => {
  const tabs: Array<TabType<Types.TabKey>> = [
    {badgeNumber: props.resetUserCount, title: 'members' as const},
    ...(!props.isBig ? [{title: 'emoji' as const}] : []),
    ...(props.isBig || props.admin ? [{title: 'channels' as const}] : []),
    ...(props.isBig ? [{title: 'emoji' as const}] : []),
    {icon: Styles.isPhone ? 'iconfont-gear' : undefined, title: 'settings' as const},
    // TODO: should we not show bots if there are no bots and you have no permissions?
    {title: 'bots' as const},
    ...(props.numSubteams > 0 || props.showSubteams ? [{title: 'subteams' as const}] : []),
  ]

  const tabContent = (
    <Kb.Tabs
      clickableBoxStyle={styles.clickableBox}
      tabs={tabs}
      selectedTab={props.selectedTab}
      onSelect={props.setSelectedTab}
      style={styles.tabContainer}
      showProgressIndicator={false}
      tabStyle={styles.tab}
    />
  )
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box style={styles.container}>
        {Styles.isMobile ? (
          <Kb.ScrollView
            horizontal={true}
            contentContainerStyle={{minWidth: '100%'}}
            alwaysBounceHorizontal={false}
          >
            {tabContent}
          </Kb.ScrollView>
        ) : (
          tabContent
        )}
      </Kb.Box>
      {!!props.error && <Kb.Banner color="red">{props.error}</Kb.Banner>}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  clickableBox: Styles.platformStyles({
    isElectron: {flex: 1},
    isMobile: {
      flexGrow: 1,
    },
  }),
  container: {backgroundColor: Styles.globalColors.white},
  inlineProgressIndicator: {
    height: 17,
    position: 'absolute',
    right: Styles.globalMargins.small,
    top: Styles.globalMargins.small,
    width: 17,
  },
  tab: Styles.platformStyles({
    isElectron: {flexGrow: 1},
    isMobile: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  tabContainer: {
    backgroundColor: Styles.globalColors.white,
    flexBasis: '100%',
    marginTop: 0,
  },
}))

export default TeamTabs
