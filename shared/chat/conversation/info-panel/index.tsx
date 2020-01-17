// 1. connect invidual pieces and clean out connect
// 2. make items calc cleaner
// OMG refactor this
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as TeamsTypes from '../../../constants/types/teams'
import flags from '../../../util/feature-flags'
import {Props as HeaderHocProps} from '../../../common-adapters/header-hoc/types'
import {AdhocHeader, TeamHeader} from './header'
import SettingsPanel from './settings'
import Participant from './participant'
import Bot from './bot'
import {AttachmentTypeSelector, DocView, LinkView, MediaView} from './attachments'

export type Panel = 'settings' | 'members' | 'attachments' | 'bots'
export type ParticipantTyp = {
  username: string
  fullname: string
  isAdmin: boolean
  isOwner: boolean
}

export type EntityType = 'adhoc' | 'small team' | 'channel'
export type Section = {
  data: Array<any>
  renderItem: (i: {item: any; index: number}) => void
  renderSectionHeader?: (i: any) => void
}

type Thumb = {
  ctime: number
  height: number
  isVideo: boolean
  onClick: () => void
  previewURL: string
  width: number
}

type MediaProps = {
  onLoadMore?: () => void
  thumbs: Array<Thumb>
  status: Types.AttachmentViewStatus
}

type Doc = {
  author: string
  ctime: number
  downloading: boolean
  fileName: string
  name: string
  progress: number
  onDownload?: () => void
  onShowInFinder?: () => void
}

type DocProps = {
  docs: Array<Doc>
  onLoadMore?: () => void
  status: Types.AttachmentViewStatus
}

type Link = {
  author: string
  ctime: number
  snippet: string
  title?: string
  url?: string
}

type LinkProps = {
  links: Array<Link>
  onLoadMore?: () => void
  status: Types.AttachmentViewStatus
}

export type InfoPanelProps = {
  loadDelay?: number
  selectedConversationIDKey: Types.ConversationIDKey
  participants: ReadonlyArray<ParticipantTyp>
  installedBots: ReadonlyArray<RPCTypes.FeaturedBot>
  featuredBots: ReadonlyArray<RPCTypes.FeaturedBot>
  isPreview: boolean
  teamID: TeamsTypes.TeamID
  teamname?: string
  channelname?: string
  smallTeam: boolean
  selectedAttachmentView: RPCChatTypes.GalleryItemTyp
  selectedTab: Panel
  showAuditingBanner: boolean

  // Attachment stuff
  docs: DocProps
  links: LinkProps
  media: MediaProps
  onAttachmentViewChange: (typ: RPCChatTypes.GalleryItemTyp) => void

  // Used by HeaderHoc.
  onBack: (() => void) | undefined

  // Used by Participant.
  onShowProfile: (username: string) => void

  // Used for conversations.
  onShowNewTeamDialog: () => void
  onSelectTab: (p: Panel) => void

  // Used for small and big teams.
  canSetMinWriterRole: boolean
  canSetRetention: boolean

  // Used for big teams.
  description?: string
  onEditChannel: () => void

  // Used for bots
  canManageBots: boolean
  loadedAllBots: boolean
  loadingBots: boolean
  onSearchFeaturedBots: (username: string) => void
  onLoadMoreBots: () => void
  onBotSelect: (username: string) => void
  onBotAdd: () => void
} & HeaderHocProps

const TabText = ({selected, text}: {selected: boolean; text: string}) => (
  <Kb.Text type="BodySmallSemibold" style={selected ? styles.tabTextSelected : undefined}>
    {text}
  </Kb.Text>
)

class _InfoPanel extends React.PureComponent<InfoPanelProps> {
  componentDidUpdate(prevProps: InfoPanelProps) {
    if (this.props.selectedConversationIDKey !== prevProps.selectedConversationIDKey) {
      this.loadAttachments()
    }
  }
  componentDidMount() {
    if (this.props.selectedTab === 'attachments') {
      this.loadAttachments()
    }
    if (this.props.selectedTab === 'bots') {
      this.loadBots()
    }
  }

  private loadAttachments = () => {
    this.props.onAttachmentViewChange(this.props.selectedAttachmentView)
  }

  private loadBots = () => {
    if (this.props.featuredBots.length === 0 && !this.props.loadedAllBots) {
      this.props.onLoadMoreBots()
    }
  }

  private getEntityType = (): EntityType => {
    if (this.props.teamname && this.props.channelname) {
      return this.props.smallTeam ? 'small team' : 'channel'
    }
    return 'adhoc'
  }

  private isSelected = (s: Panel) => {
    return s === this.props.selectedTab
  }

  private getTabPanels = (): Array<Panel> => [
    'members' as const,
    'attachments' as const,
    ...(flags.botUI ? ['bots' as const] : []),
    ...(this.props.isPreview ? [] : ['settings' as const]),
  ]

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

  private renderHeader = () => {
    const entityType = this.getEntityType()
    const header = (
      <Kb.Box2 direction="vertical" gap="tiny" gapStart={true} fullWidth={true}>
        {entityType === 'small team' || entityType === 'channel' ? (
          <TeamHeader conversationIDKey={this.props.selectedConversationIDKey} />
        ) : (
          <AdhocHeader
            onShowNewTeamDialog={this.props.onShowNewTeamDialog}
            participants={this.props.participants}
          />
        )}
      </Kb.Box2>
    )
    return header
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

  private getSettingsSections = () => [
    {
      data: ['tab'],
      renderItem: () => (
        <SettingsPanel conversationIDKey={this.props.selectedConversationIDKey} key="settings" />
      ),
      renderSectionHeader: this.renderTabs,
    },
  ]

  private getMembersSections = () => {
    const auditingBannerItem = 'auditing banner'
    return [
      {
        data: [...(this.props.showAuditingBanner ? [auditingBannerItem] : []), ...this.props.participants],
        renderItem: ({item}) => {
          if (item === auditingBannerItem) {
            return (
              <Kb.Banner color="grey" small={true}>
                Auditing team members...
              </Kb.Banner>
            )
          }
          if (!item.username) {
            return null
          }
          return (
            <Participant
              botAlias={item.botAlias}
              fullname={item.fullname}
              isAdmin={item.isAdmin}
              isOwner={item.isOwner}
              username={item.username}
              onShowProfile={this.props.onShowProfile}
            />
          )
        },
        renderSectionHeader: this.renderTabs,
      },
    ]
  }

  private getAttachmentsSections = () => {
    const commonSections = [
      {
        data: ['avselector'],
        renderItem: () => (
          <AttachmentTypeSelector
            selectedView={this.props.selectedAttachmentView}
            onSelectView={this.props.onAttachmentViewChange}
          />
        ),
        renderSectionHeader: this.renderTabs,
      },
    ]
    switch (this.props.selectedAttachmentView) {
      case RPCChatTypes.GalleryItemTyp.media:
        return [
          ...commonSections,
          ...new MediaView().getSections(
            this.props.media.thumbs,
            this.props.media.onLoadMore,
            this.loadAttachments,
            this.props.media.status
          ),
        ]
      case RPCChatTypes.GalleryItemTyp.doc:
        return [
          ...commonSections,
          ...new DocView().getSections(
            this.props.docs.docs,
            this.props.docs.onLoadMore,
            this.loadAttachments,
            this.props.docs.status
          ),
        ]
      case RPCChatTypes.GalleryItemTyp.link:
        return [
          ...commonSections,
          ...new LinkView().getSections(
            this.props.links.links,
            this.props.links.onLoadMore,
            this.loadAttachments,
            this.props.links.status
          ),
        ]
    }
  }

  private getBotsSections = () => {
    const inThisChannelHeader = 'bots: in this channel'
    const featuredBotsHeader = 'bots: featured bots'
    const loadMoreBotsButton = 'bots: load more'
    const addBotButton = 'bots: add bot'
    const featuredBotSpinner = 'bots: featured spinners'
    return [
      {
        data: [
          ...(this.props.canManageBots ? [addBotButton] : []),
          ...(this.props.installedBots.length > 0 ? [inThisChannelHeader] : []),
          ...this.props.installedBots,
          featuredBotsHeader,
          ...(this.props.featuredBots.length > 0 ? this.props.featuredBots : []),
          ...(!this.props.loadedAllBots && this.props.featuredBots.length > 0 ? [loadMoreBotsButton] : []),
          ...(this.props.loadingBots ? [featuredBotSpinner] : []),
        ],
        renderItem: ({item}) => {
          if (item === addBotButton) {
            return (
              <Kb.Button
                mode="Primary"
                type="Default"
                label="Add a bot"
                style={styles.addBot}
                onClick={this.props.onBotAdd}
              />
            )
          }
          if (item === inThisChannelHeader) {
            return (
              <Kb.Text type="Header" style={styles.botHeaders}>
                {this.props.teamname ? 'Installed in this team' : 'In this conversation'}
              </Kb.Text>
            )
          }
          if (item === featuredBotsHeader) {
            return (
              <Kb.Text type="Header" style={styles.botHeaders}>
                Featured
              </Kb.Text>
            )
          }
          if (item === featuredBotSpinner) {
            return <Kb.ProgressIndicator type="Large" />
          }
          if (item === loadMoreBotsButton) {
            return (
              <Kb.Button
                label="Load more"
                mode="Secondary"
                type="Default"
                style={styles.addBot}
                onClick={() => this.props.onLoadMoreBots()}
              />
            )
          }
          if (!item.botUsername) {
            return null
          } else {
            return (
              <Bot
                {...item}
                conversationIDKey={this.props.selectedConversationIDKey}
                onClick={this.props.onBotSelect}
                showAddToChannel={
                  this.props.installedBots.includes(item) &&
                  !this.props.smallTeam &&
                  !this.props.participants.find(p => p.username === item.botUsername)
                }
              />
            )
          }
        },
        renderSectionHeader: this.renderTabs,
      },
    ]
  }

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

    const commonSections = [
      {
        data: ['header'],
        renderItem: this.renderHeader,
      },
    ]
    let sections: Array<Section>
    switch (this.props.selectedTab) {
      case 'settings':
        sections = [...commonSections, ...this.getSettingsSections()]
        break
      case 'members':
        sections = [...commonSections, ...this.getMembersSections()]
        break
      case 'attachments':
        sections = [...commonSections, ...this.getAttachmentsSections()]
        break
      case 'bots':
        sections = [...commonSections, ...this.getBotsSections()]
        break
      default:
        sections = commonSections
    }
    return (
      <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} fullHeight={true}>
        <Kb.SectionList
          stickySectionHeadersEnabled={true}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({section}) => section?.renderSectionHeader?.({section}) ?? null}
          sections={sections}
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addBot: {
        marginBottom: Styles.globalMargins.xtiny,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
        marginTop: Styles.globalMargins.small,
      },
      botHeaders: {
        marginBottom: Styles.globalMargins.tiny,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
        marginTop: Styles.globalMargins.tiny,
      },
      container: Styles.platformStyles({
        common: {alignItems: 'stretch', paddingBottom: Styles.globalMargins.tiny},
        isElectron: {
          backgroundColor: Styles.globalColors.white,
          borderLeft: `1px solid ${Styles.globalColors.black_10}`,
          width: 320,
        },
      }),
      tabContainerStyle: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.white,
        },
        // TODO: this is less than ideal
        isElectron: {
          overflowX: 'hidden',
          overflowY: 'hidden',
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
