import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import flags from '../../../util/feature-flags'
import {AdhocHeader, TeamHeader} from './header'
import SettingsList from './settings'
import MembersList from './members'
import BotsList from './bot'
import AttachmentsList from './attachments'
import {MaybeTeamRoleType} from 'constants/types/teams'
import * as TeamConstants from '../../../constants/teams'
import {infoPanelWidthElectron, infoPanelWidthTablet} from './common'
import {Tab as TabType} from '../../../common-adapters/tabs'

export type Panel = 'settings' | 'members' | 'attachments' | 'bots'
type InfoPanelProps = {
  channelname?: string
  isPreview: boolean
  onCancel?: () => void
  onSelectTab: (p: Panel) => void
  selectedConversationIDKey: Types.ConversationIDKey
  selectedTab: Panel
  smallTeam: boolean
  teamname?: string
  yourRole: MaybeTeamRoleType
}

export class InfoPanel extends React.PureComponent<InfoPanelProps> {
  private getTabs = (): Array<TabType<Panel>> => {
    var showSettings = !this.props.isPreview
    if (flags.teamsRedesign) {
      showSettings =
        !this.props.isPreview ||
        TeamConstants.isAdmin(this.props.yourRole) ||
        TeamConstants.isOwner(this.props.yourRole)
    }

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
          {this.props.teamname && this.props.channelname ? (
            <TeamHeader conversationIDKey={this.props.selectedConversationIDKey} />
          ) : (
            <AdhocHeader conversationIDKey={this.props.selectedConversationIDKey} />
          )}
        </Kb.Box2>
      ),
    },
  ]

  render() {
    if (!this.props.selectedConversationIDKey) {
      // if we dont have a valid conversation ID, just render a spinner
      return (
        <Kb.Box2
          direction="vertical"
          style={Styles.collapseStyles([styles.container, {alignItems: 'center'}])}
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
            conversationIDKey={this.props.selectedConversationIDKey}
            isPreview={this.props.isPreview}
            renderTabs={this.renderTabs}
            commonSections={this.commonSections}
          />
        )
        break
      case 'members':
        sectionList = (
          <MembersList
            conversationIDKey={this.props.selectedConversationIDKey}
            renderTabs={this.renderTabs}
            commonSections={this.commonSections}
          />
        )
        break
      case 'attachments':
        sectionList = (
          <AttachmentsList
            conversationIDKey={this.props.selectedConversationIDKey}
            renderTabs={this.renderTabs}
            commonSections={this.commonSections}
          />
        )
        break
      case 'bots':
        sectionList = (
          <BotsList
            conversationIDKey={this.props.selectedConversationIDKey}
            renderTabs={this.renderTabs}
            commonSections={this.commonSections}
          />
        )
        break
      default:
        sectionList = null
    }
    if (Styles.isTablet) {
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
          {Styles.isMobile && (
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      clickableTabStyle: Styles.platformStyles({
        isMobile: {width: undefined},
      }),
      container: Styles.platformStyles({
        common: {alignItems: 'stretch', paddingBottom: Styles.globalMargins.tiny},
        isElectron: {
          backgroundColor: Styles.globalColors.white,
          borderLeft: `1px solid ${Styles.globalColors.black_10}`,
          width: infoPanelWidthElectron,
        },
        isTablet: {
          paddingTop: Styles.globalMargins.small,
          width: infoPanelWidthTablet,
        },
      }),
      containerBorder: {
        backgroundColor: Styles.globalColors.black_10,
        width: tabletContainerBorderSize,
      },
      containerOuterTablet: {width: infoPanelWidthTablet + tabletContainerBorderSize},
      tab: {
        paddingLeft: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.xsmall,
      },
      tabContainer: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.white,
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
    } as const)
)
