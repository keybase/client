import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import {AdhocHeader, TeamHeader} from './header'
import SettingsList from './settings'
import MembersList from './members'
import BotsList from './bot'
import AttachmentsList from './attachments'
import {infoPanelWidthElectron, infoPanelWidthTablet} from './common'
import type {Tab as TabType} from '@/common-adapters/tabs'

type Props = {
  tab?: 'settings' | 'members' | 'attachments' | 'bots'
}

const InfoPanelConnector = (props: Props) => {
  const storeSelectedTab = C.useChatState(s => s.infoPanelSelectedTab)
  const initialTab = props.tab ?? storeSelectedTab
  const conversationIDKey = C.useChatContext(s => s.id)
  const meta = C.useConvoState(conversationIDKey, s => s.meta)
  const shouldNavigateOut = meta.conversationIDKey === C.Chat.noConversationIDKey
  const yourRole = C.useTeamsState(s => C.Teams.getRole(s, meta.teamID))
  const isPreview = meta.membershipType === 'youArePreviewing'
  const channelname = meta.channelname
  const smallTeam = meta.teamType !== 'big'
  const teamname = meta.teamname

  const [selectedTab, onSelectTab] = React.useState<Panel | undefined>(initialTab)
  const [lastSNO, setLastSNO] = React.useState(shouldNavigateOut)

  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const clearAttachmentView = C.useConvoState(conversationIDKey, s => s.dispatch.clearAttachmentView)
  const onCancel = () => {
    showInfoPanel(false, undefined)
    clearAttachmentView()
  }
  const onGoToInbox = C.useChatState(s => s.dispatch.navigateToInbox)

  if (lastSNO !== shouldNavigateOut) {
    setLastSNO(shouldNavigateOut)
    if (!lastSNO && shouldNavigateOut) {
      onGoToInbox()
    }
  }

  const p = {
    channelname,
    isPreview,
    onCancel,
    onSelectTab,
    selectedTab: selectedTab ?? 'members',
    smallTeam,
    teamname,
    yourRole,
  }
  return <_InfoPanel {...p} conversationIDKey={conversationIDKey} />
}

export type Panel = 'settings' | 'members' | 'attachments' | 'bots'
type InfoPanelProps = {
  channelname?: string
  isPreview: boolean
  onCancel?: () => void
  onSelectTab: (p: Panel) => void
  selectedTab: Panel
  smallTeam: boolean
  teamname?: string
  yourRole: T.Teams.MaybeTeamRoleType
}

class _InfoPanel extends React.PureComponent<InfoPanelProps & {conversationIDKey: T.Chat.ConversationIDKey}> {
  private getTabs = (): Array<TabType<Panel>> => {
    const showSettings =
      !this.props.isPreview || C.Teams.isAdmin(this.props.yourRole) || C.Teams.isOwner(this.props.yourRole)

    return [
      {title: 'members' as const},
      {title: 'attachments' as const},
      {title: 'bots' as const},
      ...(showSettings ? [{title: 'settings' as const}] : []),
    ]
  }

  private renderTabs = () => {
    const tabs = this.getTabs()
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Tabs
          tabs={tabs}
          selectedTab={this.props.selectedTab}
          onSelect={this.props.onSelectTab}
          style={styles.tabContainer}
          tabStyle={styles.tab}
          clickableTabStyle={styles.clickableTabStyle}
        />
      </Kb.Box2>
    )
  }

  private commonSections = [
    {
      data: [{key: 'header-item'}], // 'header' cannot be used as a key, RN uses that key.
      key: 'header-section',
      renderItem: () => (
        <Kb.Box2 direction="vertical" gap="tiny" gapStart={true} fullWidth={true}>
          {this.props.teamname && this.props.channelname ? <TeamHeader /> : <AdhocHeader />}
        </Kb.Box2>
      ),
      type: 'header-section',
    } as const,
  ]

  render() {
    if (!this.props.conversationIDKey) {
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
    switch (this.props.selectedTab) {
      case 'settings':
        sectionList = (
          <SettingsList
            isPreview={this.props.isPreview}
            renderTabs={this.renderTabs}
            commonSections={this.commonSections}
          />
        )
        break
      case 'members':
        sectionList = <MembersList renderTabs={this.renderTabs} commonSections={this.commonSections} />
        break
      case 'attachments':
        sectionList = <AttachmentsList renderTabs={this.renderTabs} commonSections={this.commonSections} />
        break
      case 'bots':
        sectionList = <BotsList renderTabs={this.renderTabs} commonSections={this.commonSections} />
        break
      default:
        sectionList = null
    }
    if (Kb.Styles.isTablet) {
      // Use a View to make the left border.
      return (
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          fullHeight={true}
          style={styles.containerOuterTablet}
        >
          <Kb.Box2 direction="vertical" fullHeight={true} style={styles.containerBorder}></Kb.Box2>
          <Kb.Box2 direction="vertical" style={styles.container}>
            {sectionList}
          </Kb.Box2>
        </Kb.Box2>
      )
    } else {
      return (
        <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} fullHeight={true}>
          {Kb.Styles.isMobile && (
            <Kb.HeaderHocHeader
              onLeftAction={this.props.onCancel}
              leftAction="cancel"
              customCancelText="Done"
            />
          )}
          {sectionList}
        </Kb.Box2>
      )
    }
  }
}

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
        common: {
          backgroundColor: Kb.Styles.globalColors.white,
        },
        // TODO: this is less than ideal
        isElectron: {
          overflowX: 'hidden',
          overflowY: 'hidden',
        },
        isMobile: {
          marginTop: 0,
        },
      }),
    }) as const
)

export default InfoPanelConnector
