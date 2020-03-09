import * as React from 'react'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import {Tab as TabType} from '../../../common-adapters/tabs'

export type TabKey = 'members' | 'attachments' | 'bots' | 'settings' | 'loading'

export type Props = {
  admin: boolean
  teamID: Types.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
  selectedTab: TabKey
  setSelectedTab: (t: TabKey) => void
}

const ChannelTabs = (props: Props) => {
  const {selectedTab, setSelectedTab, teamID} = props
  const teamMeta = Container.useSelector(state => Constants.getTeamMeta(state, teamID))
  const error = Container.useSelector(state => state.teams.errorInAddToTeam)
  const waiting = Container.useAnyWaiting(
    Constants.teamWaitingKey(teamMeta.teamname),
    Constants.teamTarsWaitingKey(teamMeta.teamname)
  )
  const tabs: Array<TabType<TabKey>> = [
    {title: 'members' as const},
    {title: 'attachments' as const},
    {title: 'bots' as const},
    ...(props.admin ? [{title: 'settings' as const}] : []),
  ]

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box style={styles.container}>
        <Kb.Tabs
          clickableBoxStyle={styles.clickableBox}
          tabs={tabs}
          selectedTab={selectedTab}
          onSelect={setSelectedTab}
          style={styles.tabContainer}
          tabStyle={styles.tab}
          showProgressIndicator={!Styles.isMobile && waiting}
        />
      </Kb.Box>
      {!!error && <Kb.Banner color="red">{error}</Kb.Banner>}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  clickableBox: Styles.platformStyles({
    isMobile: {
      flexGrow: 1,
    },
  }),
  container: {
    backgroundColor: Styles.globalColors.white,
  },
  tab: Styles.platformStyles({
    isElectron: {
      flexGrow: 1,
    },
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

export default ChannelTabs
