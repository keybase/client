import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import * as Teams from '@/constants/teams'
import * as React from 'react'
import {navigateToInbox} from '@/constants/router'
import {AdhocHeader, TeamHeader} from './header'
import SettingsList from './settings'
import MembersList from './members'
import BotsList from './bot'
import AttachmentsList from './attachments'
import {infoPanelWidthElectron, infoPanelWidthTablet} from './common'
import type {Tab as TabType} from '@/common-adapters/tabs'
import {ChatTeamProvider, useChatTeam} from '../team-hooks'

type Props = {
  tab?: 'settings' | 'members' | 'attachments' | 'bots'
}

const InfoPanelConnector = (ownProps: Props) => {
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const meta = ConvoState.useConvoState(conversationIDKey, s => s.meta)
  const shouldNavigateOut = meta.conversationIDKey === Chat.noConversationIDKey
  const isPreview = meta.membershipType === 'youArePreviewing'
  const channelname = meta.channelname
  const teamname = meta.teamname
  const {role: yourRole} = useChatTeam(meta.teamID, teamname)

  const [uncontrolledSelectedTab, onSelectTab] = React.useState<Panel>('members')
  const selectedTab = ownProps.tab ?? uncontrolledSelectedTab
  const [lastSNO, setLastSNO] = React.useState(shouldNavigateOut)

  const showInfoPanel = ConvoState.useChatContext(s => s.dispatch.showInfoPanel)
  const clearAttachmentView = ConvoState.useConvoState(conversationIDKey, s => s.dispatch.clearAttachmentView)
  React.useEffect(() => {
    return () => {
      // Only call showInfoPanel(false) on mobile where the panel is a separate route.
      // On desktop the panel is inline and this cleanup fires during StrictMode
      // double-effect, which immediately hides the panel.
      if (Kb.Styles.isMobile) {
        showInfoPanel(false, undefined)
      }
      clearAttachmentView()
    }
  }, [showInfoPanel, clearAttachmentView])
  if (lastSNO !== shouldNavigateOut) {
    setLastSNO(shouldNavigateOut)
    if (!lastSNO && shouldNavigateOut) {
      navigateToInbox()
    }
  }

  const getTabs = (): Array<TabType<Panel>> => {
    const showSettings = !isPreview || Teams.isAdmin(yourRole) || Teams.isOwner(yourRole)

    return [
      {title: 'members' as const},
      {title: 'attachments' as const},
      {title: 'bots' as const},
      ...(showSettings ? [{title: 'settings' as const}] : []),
    ]
  }

  const commonSections = [
    {
      data: [{type: 'header-item'}],
      renderItem: () => (
        <Kb.Box2 direction="vertical" gap="tiny" gapStart={true} fullWidth={true}>
          {teamname && channelname ? <TeamHeader /> : <AdhocHeader />}
        </Kb.Box2>
      ),
    },
    {
      data: [{type: 'tabs'}],
      renderItem: () => null,
      renderSectionHeader: () => {
        const tabs = getTabs()
        return (
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.Tabs
              tabs={tabs}
              selectedTab={selectedTab}
              onSelect={onSelectTab}
              style={styles.tabContainer}
              tabStyle={styles.tab}
              clickableTabStyle={styles.clickableTabStyle}
            />
          </Kb.Box2>
        )
      },
    },
  ] as const

  if (!conversationIDKey) {
    // if we dont have a valid conversation ID, just render a spinner
    return (
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([styles.container, {alignItems: 'center'}])}
        fullWidth={true}
        centerChildren={true}
      >
        <Kb.ProgressIndicator type="Large" />
      </Kb.Box2>
    )
  }

  let sectionList: React.ReactNode
  switch (selectedTab) {
    case 'settings':
      sectionList = <SettingsList isPreview={isPreview} commonSections={commonSections} />
      break
    case 'members':
      sectionList = <MembersList commonSections={commonSections} />
      break
    case 'attachments':
      sectionList = <AttachmentsList commonSections={commonSections} />
      break
    case 'bots':
      sectionList = <BotsList commonSections={commonSections} />
      break
    default:
      sectionList = null
  }
  sectionList = <ChatTeamProvider>{sectionList}</ChatTeamProvider>

  if (Kb.Styles.isTablet) {
    // Use a View to make the left border.
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} style={styles.containerOuterTablet}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.containerBorder}></Kb.Box2>
        <Kb.Box2 direction="vertical" style={styles.container}>
          {sectionList}
        </Kb.Box2>
      </Kb.Box2>
    )
  } else {
    return (
      <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} fullHeight={true}>
        {sectionList}
      </Kb.Box2>
    )
  }
}

export type Panel = 'settings' | 'members' | 'attachments' | 'bots'

const tabletContainerBorderSize = 1
const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      clickableTabStyle: Kb.Styles.platformStyles({
        isMobile: {width: undefined},
      }),
      container: Kb.Styles.platformStyles({
        common: {alignItems: 'stretch', paddingBottom: Kb.Styles.globalMargins.tiny},
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          borderLeft: `1px solid ${Kb.Styles.globalColors.black_10}`,
          width: infoPanelWidthElectron,
        },
        isTablet: {
          paddingTop: Kb.Styles.globalMargins.small,
          width: infoPanelWidthTablet,
        },
      }),
      containerBorder: {
        backgroundColor: Kb.Styles.globalColors.black_10,
        width: tabletContainerBorderSize,
      },
      containerOuterTablet: {width: infoPanelWidthTablet + tabletContainerBorderSize},
      tab: {
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        paddingRight: Kb.Styles.globalMargins.xsmall,
      },
      tabContainer: Kb.Styles.platformStyles({
        common: {backgroundColor: Kb.Styles.globalColors.white},
        // TODO: this is less than ideal
        isElectron: {
          overflowX: 'hidden',
          overflowY: 'hidden',
        },
        isMobile: {marginTop: 0},
      }),
    }) as const
)

export default InfoPanelConnector
