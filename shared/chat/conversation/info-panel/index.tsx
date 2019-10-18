import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import {Props as HeaderHocProps} from '../../../common-adapters/header-hoc/types'
import {AdhocHeader, TeamHeader} from './header'
import {SettingsPanel} from './panels'
import Participant from './participant'
import {AttachmentTypeSelector, DocView, LinkView, MediaView} from './attachments'

export type Panel = 'settings' | 'members' | 'attachments'
export type ParticipantTyp = {
  username: string
  fullname: string
  isAdmin: boolean
  isOwner: boolean
}
export type EntityType = 'adhoc' | 'small team' | 'channel'
export type Section = {
  data: Array<any>
  renderItem: ({item: any, index: number}) => void
  renderSectionHeader: (i: any) => void
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
  title: string
  url: string
}

type LinkProps = {
  links: Array<Link>
  onLoadMore?: () => void
  status: Types.AttachmentViewStatus
}

const auditingBannerItem = 'auditing banner'

export type InfoPanelProps = {
  loadDelay?: number
  selectedConversationIDKey: Types.ConversationIDKey
  participants: ReadonlyArray<ParticipantTyp>
  isPreview: boolean
  teamname?: string
  channelname?: string
  smallTeam: boolean
  admin: boolean
  ignored: boolean
  spinnerForHide: boolean
  selectedAttachmentView: RPCChatTypes.GalleryItemTyp
  selectedTab: Panel
  showAuditingBanner: boolean

  // Attachment stuff
  docs: DocProps
  links: LinkProps
  media: MediaProps
  onAttachmentViewChange: (typ: RPCChatTypes.GalleryItemTyp) => void

  // Used by HeaderHoc.
  onBack: () => void

  // Used by Participant.
  onShowProfile: (username: string) => void

  // Used for conversations.
  onShowBlockConversationDialog: () => void
  onShowClearConversationDialog: () => void
  onShowNewTeamDialog: () => void
  onHideConv: () => void
  onUnhideConv: () => void
  onSelectTab: (p: Panel) => void

  // Used for small and big teams.
  canSetMinWriterRole: boolean
  canSetRetention: boolean

  // Used for big teams.
  canEditChannel: boolean
  canDeleteHistory: boolean
  description?: string
  onEditChannel: () => void
  onLeaveConversation: () => void
  onJoinChannel: () => void
} & HeaderHocProps

const TabText = ({selected, text}: {selected: boolean; text: string}) => (
  <Kb.Text type="BodySmallSemibold" style={selected ? styles.tabTextSelected : undefined}>
    {text}
  </Kb.Text>
)

class _InfoPanel extends React.PureComponent<InfoPanelProps> {
  private animationDelayLoad: NodeJS.Timeout | undefined
  componentDidMount() {
    this.animationDelayLoad = setTimeout(() => {
      if (this.props.selectedTab === 'attachments') {
        this.loadAttachments()
      }
    }, this.props.loadDelay || 0)
  }
  componentWillUnmount() {
    this.animationDelayLoad && clearTimeout(this.animationDelayLoad)
  }

  private loadAttachments = () => {
    if (this.props.selectedTab === 'attachments') {
      this.props.onAttachmentViewChange(this.props.selectedAttachmentView)
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

  private getTabs = (entityType: EntityType) => {
    const res: Array<React.ReactNode> = []
    if (entityType !== 'adhoc') {
      res.push(
        <Kb.Box2 key="members" style={styles.tabTextContainer} direction="horizontal">
          <TabText
            selected={this.isSelected('members')}
            text={`Members (${this.props.participants.length})`}
          />
        </Kb.Box2>
      )
    }
    res.push(
      <Kb.Box2 key="attachments" style={styles.tabTextContainer} direction="horizontal">
        <TabText selected={this.isSelected('attachments')} text="Attachments" />
      </Kb.Box2>
    )
    if (!this.props.isPreview) {
      res.push(
        <Kb.Box2 key="settings" style={styles.tabTextContainer} direction="horizontal">
          <TabText selected={this.isSelected('settings')} text="Settings" />
        </Kb.Box2>
      )
    }

    return res
  }

  private onSelectTab = (tab: React.ReactNode) => {
    // @ts-ignore TODO avoid using key on a node
    if (tab.key === 'attachments') {
      this.loadAttachments()
    }
    // @ts-ignore TODO avoid using key on a node
    this.props.onSelectTab(tab.key)
  }
  private renderHeader = () => {
    const entityType = this.getEntityType()
    const header = (
      <Kb.Box2 direction="vertical" gap="tiny" gapStart={true} fullWidth={true}>
        {entityType === 'small team' || entityType === 'channel' ? (
          <TeamHeader
            admin={this.props.admin}
            teamname={this.props.teamname}
            channelname={this.props.channelname}
            conversationIDKey={this.props.selectedConversationIDKey}
            isSmallTeam={entityType === 'small team'}
            isPreview={this.props.isPreview}
            participantCount={this.props.participants.length}
            onJoinChannel={this.props.onJoinChannel}
            description={this.props.description}
          />
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
  private headerSection = (): Section => {
    return {
      data: ['header'],
      renderItem: this.renderHeader,
      renderSectionHeader: () => {
        return null
      },
    }
  }

  private renderAttachmentViewSelector = () => {
    return (
      <AttachmentTypeSelector
        selectedView={this.props.selectedAttachmentView}
        onSelectView={this.props.onAttachmentViewChange}
      />
    )
  }
  private attachmentViewSelectorSection = (): Section => {
    return {
      data: ['avselector'],
      renderItem: this.renderAttachmentViewSelector,
      renderSectionHeader: () => {
        return null
      },
    }
  }

  private renderTabs = () => {
    const tabs = this.getTabs(this.getEntityType())
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
  private tabsSection = (): Section => {
    return {
      data: ['tabs'],
      renderItem: () => null,
      renderSectionHeader: this.renderTabs,
    }
  }

  private renderSectionHeader = ({section}) => {
    return section.renderSectionHeader({section})
  }

  render() {
    const entityType = this.getEntityType()
    let sections: Array<unknown> = []
    const tabsSection = this.tabsSection()
    sections.push(this.headerSection())
    let itemSizeEstimator
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
    switch (this.props.selectedTab) {
      case 'settings':
        tabsSection.renderItem = () => {
          return (
            <SettingsPanel
              canDeleteHistory={this.props.canDeleteHistory}
              conversationIDKey={this.props.selectedConversationIDKey}
              entityType={entityType}
              ignored={this.props.ignored}
              key="settings"
              onHideConv={this.props.onHideConv}
              onUnhideConv={this.props.onUnhideConv}
              onLeaveConversation={this.props.onLeaveConversation}
              onShowBlockConversationDialog={this.props.onShowBlockConversationDialog}
              onShowClearConversationDialog={this.props.onShowClearConversationDialog}
              spinnerForHide={this.props.spinnerForHide}
              teamname={this.props.teamname}
              channelname={this.props.channelname}
            />
          )
        }
        sections.push(tabsSection)
        break
      case 'members':
        if (!Styles.isMobile) {
          itemSizeEstimator = () => {
            return 56
          }
        }
        if (this.props.showAuditingBanner) {
          tabsSection.data.push(auditingBannerItem)
        }
        tabsSection.data = tabsSection.data.concat(this.props.participants)
        tabsSection.renderItem = ({item}) => {
          if (item === auditingBannerItem) {
            return (
              <Kb.Banner color="grey" small={true}>
                Auditing team members...
              </Kb.Banner>
            )
          } else if (!item.username) {
            return null
          } else {
            return (
              <Participant
                fullname={item.fullname}
                isAdmin={item.isAdmin}
                isOwner={item.isOwner}
                username={item.username}
                onShowProfile={this.props.onShowProfile}
              />
            )
          }
        }
        sections.push(tabsSection)
        break
      case 'attachments':
        {
          if (!Styles.isMobile) {
            itemSizeEstimator = () => {
              return 80
            }
          }
          let attachmentSections
          switch (this.props.selectedAttachmentView) {
            case RPCChatTypes.GalleryItemTyp.media:
              attachmentSections = new MediaView().getSections(
                this.props.media.thumbs,
                this.props.media.onLoadMore,
                this.loadAttachments,
                this.props.media.status
              )
              break
            case RPCChatTypes.GalleryItemTyp.doc:
              attachmentSections = new DocView().getSections(
                this.props.docs.docs,
                this.props.docs.onLoadMore,
                this.loadAttachments,
                this.props.docs.status
              )
              break
            case RPCChatTypes.GalleryItemTyp.link:
              attachmentSections = new LinkView().getSections(
                this.props.links.links,
                this.props.links.onLoadMore,
                this.loadAttachments,
                this.props.links.status
              )
              break
          }
          sections.push(tabsSection)
          sections.push(this.attachmentViewSelectorSection())
          sections = sections.concat(attachmentSections)
        }
        break
    }
    return (
      <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} fullHeight={true}>
        <Kb.SectionList
          itemSizeEstimator={itemSizeEstimator}
          stickySectionHeadersEnabled={true}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={this.renderSectionHeader}
          sections={sections}
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      attachmentsLoading: {
        height: Styles.globalMargins.small,
        width: Styles.globalMargins.small,
      },
      container: Styles.platformStyles({
        common: {alignItems: 'stretch', flex: 1, paddingBottom: Styles.globalMargins.tiny},
        isElectron: {
          backgroundColor: Styles.globalColors.white,
          borderLeft: `1px solid ${Styles.globalColors.black_10}`,
        },
      }),
      tabContainerStyle: {
        backgroundColor: Styles.globalColors.white,
      },
      tabStyle: {
        paddingLeft: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.xsmall,
      },
      tabTextContainer: {
        justifyContent: 'center',
      },
      tabTextSelected: {color: Styles.globalColors.black},
    } as const)
)

const InfoPanel = Kb.HeaderOnMobile(_InfoPanel)

export {InfoPanel}
