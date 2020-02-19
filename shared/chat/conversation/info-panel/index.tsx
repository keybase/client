import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import flags from '../../../util/feature-flags'
import {Props as HeaderHocProps} from '../../../common-adapters/header-hoc/types'
import {AdhocHeader, TeamHeader} from './header'
import SettingsList from './settings'
import MembersList from './members'
import BotsList from './bot'
import AttachmentsList from './attachments'
import {MaybeTeamRoleType} from 'constants/types/teams'
import * as TeamConstants from '../../../constants/teams'

export type Panel = 'settings' | 'members' | 'attachments' | 'bots'
type InfoPanelProps = {
  channelname?: string
  isPreview: boolean
  onBack: (() => void) | undefined
  onSelectTab: (p: Panel) => void
  selectedConversationIDKey: Types.ConversationIDKey
  selectedTab: Panel
  smallTeam: boolean
  teamname?: string
  yourRole: MaybeTeamRoleType
} & HeaderHocProps

const TabText = ({selected, text}: {selected: boolean; text: string}) => (
  <Kb.Text type="BodySmallSemibold" style={selected ? styles.tabTextSelected : undefined}>
    {text}
  </Kb.Text>
)

class _InfoPanel extends React.PureComponent<InfoPanelProps> {
  private isSelected = (s: Panel) => s === this.props.selectedTab

  private getTabPanels = (): Array<Panel> => {
    var showSettings = !this.props.isPreview
    if (flags.teamsRedesign) {
      showSettings =
        !this.props.isPreview ||
        TeamConstants.isAdmin(this.props.yourRole) ||
        TeamConstants.isOwner(this.props.yourRole)
    }

    return [
      'members' as const,
      'attachments' as const,
      ...(flags.botUI ? ['bots' as const] : []),
      ...(showSettings ? ['settings' as const] : []),
    ]
  }

  private getTabs = () =>
    this.getTabPanels().map(p => {
      switch (p) {
        case 'settings':
          return (
            <Kb.Box2 key="settings" style={styles.tabTextContainer} direction="horizontal">
              <TabText selected={this.isSelected('settings')} text="Settings" />
            </Kb.Box2>
          )
        case 'members':
          return (
            <Kb.Box2 key="members" style={styles.tabTextContainer} direction="horizontal">
              <TabText selected={this.isSelected('members')} text="Members" />
            </Kb.Box2>
          )
        case 'attachments':
          return (
            <Kb.Box2 key="attachments" style={styles.tabTextContainer} direction="horizontal">
              <TabText selected={this.isSelected('attachments')} text="Attachments" />
            </Kb.Box2>
          )
        case 'bots':
          return (
            <Kb.Box2 key="bots" style={styles.tabTextContainer} direction="horizontal">
              <TabText selected={this.isSelected('bots')} text="Bots" />
            </Kb.Box2>
          )
        default:
          return null
      }
    })

  private onSelectTab = (_tab: React.ReactNode, idx: number) => {
    this.props.onSelectTab(this.getTabPanels()[idx] ?? ('members' as const))
  }

  private renderTabs = () => {
    const tabs = this.getTabs()
    const selected = tabs.find((tab: any) => tab && this.isSelected(tab.key)) || null
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Tabs
          tabs={tabs}
          selected={selected}
          onSelect={this.onSelectTab}
          style={styles.tabContainerStyle}
          tabStyle={styles.tabStyle}
        />
      </Kb.Box2>
    )
  }

  private commonSections = [
    {
      data: ['header'],
      renderItem: () => (
        <Kb.Box2 direction="vertical" gap="tiny" gapStart={true} fullWidth={true} style={styles.header}>
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
    return (
      <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} fullHeight={true}>
        {sectionList}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        common: {alignItems: 'stretch', paddingBottom: Styles.globalMargins.tiny},
        isElectron: {
          backgroundColor: Styles.globalColors.white,
          borderLeft: `1px solid ${Styles.globalColors.black_10}`,
          width: 320,
        },
        isTablet: {marginTop: Styles.globalMargins.small},
      }),
      header: Styles.platformStyles({isTablet: {marginBottom: Styles.globalMargins.small}}),
      tabContainerStyle: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.white,
        },
        // TODO: this is less than ideal
        isElectron: {
          overflowX: 'hidden',
          overflowY: 'hidden',
        },
        isTablet: {
          justifyContent: 'center',
        },
      }),
      tabStyle: {
        paddingLeft: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.xsmall,
      },
      tabTextContainer: Styles.platformStyles({
        common: {
          justifyContent: 'center',
        },
        isElectron: {
          whiteSpace: 'nowrap',
        },
      }),
      tabTextSelected: {color: Styles.globalColors.black},
    } as const)
)

export const InfoPanel = Kb.HeaderOnMobile(_InfoPanel)
