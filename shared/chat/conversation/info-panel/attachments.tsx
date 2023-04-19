import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import * as React from 'react'
import * as FsGen from '../../../actions/fs-gen'
import type * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {formatAudioRecordDuration, formatTimeForMessages} from '../../../util/timestamp'
import MessagePopup from '../messages/message-popup'
import chunk from 'lodash/chunk'
import {infoPanelWidth} from './common'
import type {Section} from '../../../common-adapters/section-list'

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

enum ThumbTyp {
  IMAGE = 0,
  VIDEO = 1,
  AUDIO = 2,
}

type Thumb = {
  key: React.Key
  ctime: number
  height: number
  typ: ThumbTyp
  onClick: () => void
  previewURL: string
  width: number
  audioDuration?: number
}

type Doc = {
  author: string
  ctime: number
  downloading: boolean
  fileName: string
  message?: Types.Message
  name: string
  progress: number
  onDownload?: () => void
  onShowInFinder?: () => void
}

type Link = {
  author: string
  ctime: number
  snippet: string
  title?: string
  url?: string
}
type InfoPanelSection = Section<
  any,
  {title?: string; renderSectionHeader?: (info: {section: Section<any, any>}) => React.ReactNode}
>

function getDateInfo<I extends {ctime: number}>(thumb: I) {
  const date = new Date(thumb.ctime)
  return {
    month: monthNames[date.getMonth()],
    year: date.getFullYear(),
  }
}

function formMonths<I extends {ctime: number; key: React.Key}>(
  items: Array<I>
): Array<{
  key: React.Key
  data: Array<I>
  month: string
  year: number
}> {
  if (items.length === 0) {
    return []
  }
  const dateInfo = getDateInfo(items[0])
  let curMonth = {
    ...dateInfo,
    data: [] as Array<I>,
    key: `month-${dateInfo.year}-${dateInfo.month}`,
  }
  const months = items.reduce<Array<typeof curMonth>>((l, item, index) => {
    const dateInfo = getDateInfo(item)
    if (dateInfo.month !== curMonth.month || dateInfo.year !== curMonth.year) {
      if (curMonth.data.length > 0) {
        l.push(curMonth)
      }
      curMonth = {
        ...dateInfo,
        data: [item],
        key: `month-${dateInfo.year}-${dateInfo.month}`,
      }
    } else {
      curMonth.data.push(item)
    }
    if (index === items.length - 1 && curMonth.data.length > 0) {
      l.push(curMonth)
    }
    return l
  }, [])
  return months
}

type Sizing = {
  dims: {
    height: number
    width: number
  }
  margins: {
    marginBottom: number
    marginLeft: number
    marginRight: number
    marginTop: number
  }
}

type MediaThumbProps = {
  thumb: Thumb
  sizing: Sizing
}

const MediaThumb = (props: MediaThumbProps) => {
  const {sizing, thumb} = props
  const [loading, setLoading] = React.useState(thumb.typ !== ThumbTyp.AUDIO)
  return (
    <Kb.Box2 direction="vertical" style={styles.thumbContainer}>
      <Kb.ClickableBox onClick={thumb.onClick} style={{...sizing.margins}}>
        {thumb.typ === ThumbTyp.AUDIO ? (
          <Kb.Box2 direction="vertical" style={{...sizing.dims}} centerChildren={true} gap="xtiny">
            <Kb.Box2 direction="vertical" centerChildren={true} style={styles.audioBackground}>
              <Kb.Icon
                type="iconfont-mic"
                style={{marginLeft: 2}}
                color={Styles.globalColors.whiteOrWhite}
                sizeType="Big"
              />
            </Kb.Box2>
            {!!thumb.audioDuration && (
              <Kb.Text type="BodyTiny">{formatAudioRecordDuration(thumb.audioDuration)}</Kb.Text>
            )}
          </Kb.Box2>
        ) : (
          <Kb.Image src={thumb.previewURL} style={{...sizing.dims}} onLoad={() => setLoading(false)} />
        )}
      </Kb.ClickableBox>
      {thumb.typ === ThumbTyp.VIDEO && (
        <Kb.Box2 direction="vertical" style={styles.durationContainer}>
          <Kb.Icon type="icon-film-64" style={styles.filmIcon} />
        </Kb.Box2>
      )}
      {loading && <Kb.ProgressIndicator style={styles.loading} />}
    </Kb.Box2>
  )
}

type DocViewRowProps = {item: Doc}

const DocViewRow = (props: DocViewRowProps) => {
  const {item} = props
  const {toggleShowingPopup, showingPopup, popup} = Kb.usePopup(attachTo =>
    item.message ? (
      <MessagePopup
        attachTo={attachTo}
        conversationIDKey={item.message.conversationIDKey}
        ordinal={item.message.id}
        onHidden={toggleShowingPopup}
        position="top right"
        visible={showingPopup}
      />
    ) : null
  )
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.ClickableBox onClick={item.onDownload} onLongPress={toggleShowingPopup}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.docRowContainer} gap="xtiny">
          <Kb.Icon type="icon-file-32" style={styles.docIcon} />
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.docRowTitle}>
            <Kb.Text type="BodySemibold">{item.name}</Kb.Text>
            {item.name !== item.fileName && <Kb.Text type="BodyTiny">{item.fileName}</Kb.Text>}
            <Kb.Text type="BodySmall">
              Sent by {item.author} • {formatTimeForMessages(item.ctime)}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ClickableBox>
      {item.downloading && (
        <Kb.Box2 direction="horizontal" style={styles.docBottom} fullWidth={true} gap="tiny">
          <Kb.Text type="BodySmall">Downloading...</Kb.Text>
          <Kb.ProgressBar ratio={item.progress} style={styles.docProgress} />
        </Kb.Box2>
      )}
      {item.onShowInFinder && (
        <Kb.Box2 direction="horizontal" style={styles.docBottom} fullWidth={true}>
          <Kb.Text type="BodySmallPrimaryLink" onClick={item.onShowInFinder}>
            Show in {Styles.fileUIName}
          </Kb.Text>
        </Kb.Box2>
      )}
      {Styles.isMobile && showingPopup && item.message && popup}
    </Kb.Box2>
  )
}

type SelectorProps = {
  selectedView: RPCChatTypes.GalleryItemTyp
  onSelectView: (typ: RPCChatTypes.GalleryItemTyp) => void
}

const getBkgColor = (selected: boolean) =>
  selected ? {backgroundColor: Styles.globalColors.blue} : {backgroundColor: undefined}
const getColor = (selected: boolean) =>
  selected ? {color: Styles.globalColors.white} : {color: Styles.globalColors.blueDark}

const AttachmentTypeSelector = (props: SelectorProps) => (
  <Kb.Box2 alignSelf="center" direction="horizontal" style={styles.selectorContainer} fullWidth={true}>
    <Kb.ClickableBox
      onClick={() => props.onSelectView(RPCChatTypes.GalleryItemTyp.media)}
      style={Styles.collapseStyles([
        styles.selectorItemContainer,
        styles.selectorMediaContainer,
        getBkgColor(props.selectedView === RPCChatTypes.GalleryItemTyp.media),
      ])}
    >
      <Kb.Text type="BodySemibold" style={getColor(props.selectedView === RPCChatTypes.GalleryItemTyp.media)}>
        Media
      </Kb.Text>
    </Kb.ClickableBox>
    <Kb.ClickableBox
      onClick={() => props.onSelectView(RPCChatTypes.GalleryItemTyp.doc)}
      style={Styles.collapseStyles([
        styles.selectorDocContainer,
        styles.selectorItemContainer,
        getBkgColor(props.selectedView === RPCChatTypes.GalleryItemTyp.doc),
      ])}
    >
      <Kb.Text type="BodySemibold" style={getColor(props.selectedView === RPCChatTypes.GalleryItemTyp.doc)}>
        Docs
      </Kb.Text>
    </Kb.ClickableBox>
    <Kb.ClickableBox
      onClick={() => props.onSelectView(RPCChatTypes.GalleryItemTyp.link)}
      style={Styles.collapseStyles([
        styles.selectorItemContainer,
        styles.selectorLinkContainer,
        getBkgColor(props.selectedView === RPCChatTypes.GalleryItemTyp.link),
      ])}
    >
      <Kb.Text type="BodySemibold" style={getColor(props.selectedView === RPCChatTypes.GalleryItemTyp.link)}>
        Links
      </Kb.Text>
    </Kb.ClickableBox>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      audioBackground: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blue,
          padding: Styles.globalMargins.tiny,
        },
        isElectron: {
          borderRadius: '50%',
        },
        isMobile: {
          borderRadius: 32,
        },
      }),
      avatar: {marginRight: Styles.globalMargins.tiny},
      container: {
        flex: 1,
        height: '100%',
      },
      docBottom: {padding: Styles.globalMargins.tiny},
      docIcon: {height: 32},
      docProgress: {alignSelf: 'center'},
      docRowContainer: {padding: Styles.globalMargins.tiny},
      docRowTitle: Styles.platformStyles({
        common: {flex: 1},
        isElectron: {
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        } as const,
      }),
      durationContainer: {
        alignSelf: 'flex-start',
        bottom: Styles.globalMargins.xtiny,
        position: 'absolute',
        right: Styles.globalMargins.xtiny,
      },
      filmIcon: {
        height: 16,
        width: 16,
      },
      flexWrap: {flexWrap: 'wrap'},
      linkContainer: {padding: Styles.globalMargins.tiny},
      linkStyle: Styles.platformStyles({
        common: {color: Styles.globalColors.black_50},
        isElectron: {
          fontSize: 13,
          lineHeight: 17,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        } as const,
        isMobile: {fontSize: 15},
      }),
      linkTime: {alignSelf: 'center'},
      loadMore: {margin: Styles.globalMargins.tiny},
      loadMoreProgress: {
        alignSelf: 'center',
        marginTop: Styles.globalMargins.tiny,
      },
      loading: {
        bottom: '50%',
        left: '50%',
        marginBottom: -12,
        marginLeft: -12,
        marginRight: -12,
        marginTop: -12,
        position: 'absolute',
        right: '50%',
        top: '50%',
        width: 24,
      },
      selectorContainer: {
        maxWidth: 460,
        padding: Styles.globalMargins.small,
      },
      selectorDocContainer: {
        borderColor: Styles.globalColors.blue,
        borderLeftWidth: 1,
        borderRadius: 0,
        borderRightWidth: 1,
      },
      selectorItemContainer: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxColumn,
          ...Styles.globalStyles.flexBoxCenter,
          borderBottomWidth: 1,
          borderColor: Styles.globalColors.blue,
          borderStyle: 'solid',
          borderTopWidth: 1,
          flex: 1,
          height: 32,
        },
        isMobile: {paddingTop: Styles.globalMargins.xxtiny},
      }),
      selectorLinkContainer: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: Styles.borderRadius,
        borderRightWidth: 1,
        borderTopLeftRadius: 0,
        borderTopRightRadius: Styles.borderRadius,
      },
      selectorMediaContainer: {
        borderBottomLeftRadius: Styles.borderRadius,
        borderBottomRightRadius: 0,
        borderLeftWidth: 1,
        borderTopLeftRadius: Styles.borderRadius,
        borderTopRightRadius: 0,
      },
      thumbContainer: {
        overflow: 'hidden',
        position: 'relative',
      },
    } as const)
)

const linkStyleOverride = {
  link: Styles.collapseStyles([styles.linkStyle, {color: Styles.globalColors.blueDark}]),
}

type Props = {
  conversationIDKey: Types.ConversationIDKey
  renderTabs: () => React.ReactNode
  commonSections: Array<Section<{key: string}, {title?: string}>>
}

const getFromMsgID = (info: Types.AttachmentViewInfo): Types.MessageID | null => {
  if (info.last || info.status !== 'success') {
    return null
  }
  const lastMessage = info.messages.length > 0 ? info.messages[info.messages.length - 1] : null
  return lastMessage ? lastMessage.id : null
}

const noAttachmentView = Constants.makeAttachmentViewInfo()

export const useAttachmentSections = (
  p: Props,
  loadImmediately: boolean,
  useFlexWrap: boolean
): Array<Section<any, {title?: string}>> => {
  const {conversationIDKey} = p
  const dispatch = Container.useDispatch()
  const [selectedAttachmentView, onSelectAttachmentView] = React.useState<RPCChatTypes.GalleryItemTyp>(
    RPCChatTypes.GalleryItemTyp.media
  )

  React.useEffect(() => {
    if (loadImmediately) {
      dispatch(Chat2Gen.createLoadAttachmentView({conversationIDKey, viewType: selectedAttachmentView}))
    }
  }, [loadImmediately, selectedAttachmentView, conversationIDKey, dispatch])

  const attachmentView = Container.useSelector(state => state.chat2.attachmentViewMap.get(conversationIDKey))
  const attachmentInfo = attachmentView?.get(selectedAttachmentView) || noAttachmentView
  const fromMsgID = getFromMsgID(attachmentInfo)

  const onLoadMore = fromMsgID
    ? () =>
        dispatch(
          Chat2Gen.createLoadAttachmentView({
            conversationIDKey,
            fromMsgID,
            viewType: selectedAttachmentView,
          })
        )
    : undefined

  const onAttachmentViewChange = (viewType: RPCChatTypes.GalleryItemTyp) => {
    onSelectAttachmentView(viewType)
  }

  const loadAttachments = () => {
    dispatch(Chat2Gen.createLoadAttachmentView({conversationIDKey, viewType: selectedAttachmentView}))
  }

  const onMediaClick = (message: Types.MessageAttachment) =>
    dispatch(
      Chat2Gen.createAttachmentPreviewSelect({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.id,
      })
    )

  const onDocDownload = (message: Types.MessageAttachment) => {
    if (Styles.isMobile) {
      dispatch(Chat2Gen.createMessageAttachmentNativeShare({message}))
    } else {
      if (!message.downloadPath) {
        dispatch(
          Chat2Gen.createAttachmentDownload({
            conversationIDKey: message.conversationIDKey,
            ordinal: message.id,
          })
        )
      }
    }
  }

  const onShowInFinder = (message: Types.MessageAttachment) =>
    message.downloadPath &&
    dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath}))

  const commonSections: Array<InfoPanelSection> = [
    ...p.commonSections,
    {
      data: [{key: 'avselector'}],
      key: 'avselector',
      renderItem: () => (
        <AttachmentTypeSelector selectedView={selectedAttachmentView} onSelectView={onAttachmentViewChange} />
      ),
      renderSectionHeader: p.renderTabs,
    },
  ]

  const loadMoreSection = {
    data: [{key: 'load more'}],
    key: 'load-more',
    renderItem: () => {
      const status = attachmentInfo.status
      if (onLoadMore && status !== 'loading') {
        return (
          <Kb.Button
            type="Default"
            mode="Secondary"
            label="Load more"
            onClick={onLoadMore}
            style={styles.loadMore}
          />
        )
      } else if (status === 'loading') {
        return <Kb.ProgressIndicator type="Small" style={styles.loadMoreProgress} />
      } else if (status === 'error') {
        return (
          <Kb.Button
            type="Danger"
            mode="Secondary"
            label="Error loading, try again"
            onClick={loadAttachments}
            style={styles.loadMore}
          />
        )
      }
      return null
    },
  }

  let sections: Array<InfoPanelSection>
  if (attachmentInfo.messages.length === 0 && attachmentInfo.status !== 'loading') {
    sections = [
      {
        data: [{key: 'no-attachments'}],
        key: 'no-attachments',
        renderItem: () => (
          <Kb.Box2 centerChildren={true} direction="horizontal" fullWidth={true}>
            <Kb.Text type="BodySmall">No attachments</Kb.Text>
          </Kb.Box2>
        ),
      },
    ]
    sections = [...commonSections, ...sections, loadMoreSection]
  } else {
    switch (selectedAttachmentView) {
      case RPCChatTypes.GalleryItemTyp.media:
        {
          const rowSize = 4 // count of images in each row
          const maxMediaThumbSize = infoPanelWidth() / rowSize
          const s = formMonths(
            (attachmentInfo.messages as Array<Types.MessageAttachment>).map(
              m =>
                ({
                  audioDuration: m.audioDuration,
                  ctime: m.timestamp,
                  height: m.previewHeight,
                  key: `media-${m.ordinal}-${m.timestamp}-${m.previewURL}`,
                  onClick: () => onMediaClick(m),
                  previewURL: m.previewURL,
                  typ:
                    m.audioAmps.length > 0
                      ? ThumbTyp.AUDIO
                      : m.videoDuration
                      ? ThumbTyp.VIDEO
                      : ThumbTyp.IMAGE,
                  width: m.previewWidth,
                } as Thumb)
            )
          ).map(month => {
            const dataUnchunked = month.data.map(thumb => ({
              debug: {
                height: thumb.height,
                maxMediaThumbSize,
                width: thumb.width,
              },
              sizing: Constants.zoomImage(thumb.width, thumb.height, maxMediaThumbSize),
              thumb,
            }))
            const dataChunked = useFlexWrap ? [dataUnchunked] : chunk(dataUnchunked, rowSize)
            const data = dataChunked.map((images, i) => ({images, key: i}))
            return {
              data,
              key: month.key,
              renderItem: ({item}: {item: Unpacked<typeof data>; index: number}) => (
                <Kb.Box2
                  direction="horizontal"
                  fullWidth={true}
                  style={useFlexWrap ? styles.flexWrap : undefined}
                >
                  {item.images.map(cell => {
                    return <MediaThumb key={cell.thumb.key} sizing={cell.sizing} thumb={cell.thumb} />
                  })}
                </Kb.Box2>
              ),
              renderSectionHeader: () => <Kb.SectionDivider label={`${month.month} ${month.year}`} />,
              title: `${month.month} ${month.year}`,
            }
          })
          sections = [...commonSections, ...s, loadMoreSection]
        }
        break
      case RPCChatTypes.GalleryItemTyp.doc:
        {
          const docs = (attachmentInfo.messages as Array<Types.MessageAttachment>).map(m => ({
            author: m.author,
            ctime: m.timestamp,
            downloading: m.transferState === 'downloading',
            fileName: m.fileName,
            key: `doc-${m.ordinal}-${m.author}-${m.timestamp}-${m.fileName}`,
            message: m,
            name: m.title || m.fileName,
            onDownload: () => onDocDownload(m),
            onShowInFinder: !Container.isMobile && m.downloadPath ? () => onShowInFinder(m) : undefined,
            progress: m.transferProgress,
          }))

          const s = formMonths(docs).map(month => ({
            data: month.data,
            key: month.key,
            renderItem: ({item}: {item: Doc}) => <DocViewRow item={item} />,
            renderSectionHeader: () => <Kb.SectionDivider label={`${month.month} ${month.year}`} />,
          }))
          sections = [...commonSections, ...s, loadMoreSection]
        }
        break
      case RPCChatTypes.GalleryItemTyp.link:
        {
          const links = attachmentInfo.messages.reduce<
            Array<{
              author: string
              ctime: number
              key: React.Key
              snippet: string
              title?: string
              url?: string
            }>
          >((l, m) => {
            if (m.type !== 'text') {
              return l
            }
            if (!m.unfurls.size) {
              l.push({
                author: m.author,
                ctime: m.timestamp,
                key: `unfurl-empty-${m.ordinal}-${m.author}-${m.timestamp}`,
                snippet: m.decoratedText?.stringValue() ?? '',
              })
            } else {
              ;[...m.unfurls.values()].forEach((u, i) => {
                if (u.unfurl.unfurlType === RPCChatTypes.UnfurlType.generic) {
                  l.push({
                    author: m.author,
                    ctime: m.timestamp,
                    key: `unfurl-${m.ordinal}-${i}-${m.author}-${m.timestamp}-${u.unfurl.generic.url}`,
                    snippet: m.decoratedText?.stringValue() ?? '',
                    title: u.unfurl.generic.title,
                    url: u.unfurl.generic.url,
                  })
                }
              })
            }
            return l
          }, [])

          const s = formMonths(links).map(month => ({
            data: month.data,
            key: month.key,
            renderItem: ({item}: {item: Link}) => {
              return (
                <Kb.Box2 direction="vertical" fullWidth={true} style={styles.linkContainer} gap="tiny">
                  <Kb.Box2 direction="vertical" fullWidth={true} gap="xxtiny">
                    <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
                      <Kb.NameWithIcon
                        avatarSize={32}
                        avatarStyle={styles.avatar}
                        colorFollowing={true}
                        username={item.author}
                        horizontal={true}
                      />
                      <Kb.Text type="BodyTiny" style={styles.linkTime}>
                        {formatTimeForMessages(item.ctime)}
                      </Kb.Text>
                    </Kb.Box2>
                    <Kb.Markdown
                      serviceOnly={true}
                      smallStandaloneEmoji={true}
                      selectable={true}
                      styleOverride={linkStyleOverride}
                      style={styles.linkStyle}
                    >
                      {item.snippet}
                    </Kb.Markdown>
                  </Kb.Box2>
                  {!!item.title && (
                    <Kb.Text
                      type="BodySmallPrimaryLink"
                      onClickURL={item.url}
                      style={Styles.collapseStyles([styles.linkStyle, {color: Styles.globalColors.blueDark}])}
                    >
                      {item.title}
                    </Kb.Text>
                  )}
                  <Kb.Divider />
                </Kb.Box2>
              )
            },
            renderSectionHeader: () => <Kb.SectionDivider label={`${month.month} ${month.year}`} />,
          }))
          sections = [...commonSections, ...s, loadMoreSection]
        }
        break
    }
  }

  return sections
}

const Attachments = (p: Props) => {
  const sections = useAttachmentSections(p, true /* loadImmediately */, false /* flexWrap */)
  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({section}: any) => section?.renderSectionHeader?.({section}) ?? null}
      sections={sections}
    />
  )
}
export default Attachments
