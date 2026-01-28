import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import type {StylesTextCrossPlatform} from '@/common-adapters/text'
import * as T from '@/constants/types'
import * as React from 'react'
import chunk from 'lodash/chunk'
import {formatAudioRecordDuration, formatTimeForMessages} from '@/util/timestamp'
import {infoPanelWidth} from './common'
import {useMessagePopup} from '../messages/message-popup'
import {useFSState} from '@/stores/fs'

type Props = {
  commonSections: ReadonlyArray<Section>
}

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
  key: string
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
  message?: T.Chat.Message
  name: string
  progress: number
  onDownload?: () => void
  onShowInFinder?: () => void
  onClick: () => void
  type: 'doc'
}

type Link = {
  author: string
  ctime: number
  snippet: string
  title?: string
  url?: string
  key: string
  id: T.Chat.MessageID
  type: 'link'
}

type ThumbData = {
  images: {
    debug: {
      height: number
      maxMediaThumbSize: number
      width: number
    }
    sizing: {
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
    thumb: Thumb
  }[]
  key: number
  type: 'thumb'
}

export type Item =
  | {type: 'header-item'}
  | {type: 'tabs'}
  | Doc
  | Link
  | ThumbData
  | {type: 'avselector'}
  | {type: 'no-attachments'}
  | {type: 'load-more'}
  | {type: 'header-section'}

type Section = Kb.SectionType<Item>

function getDateInfo<I extends {ctime: number}>(thumb: I) {
  const date = new Date(thumb.ctime)
  return {
    month: monthNames[date.getMonth()],
    year: date.getFullYear(),
  }
}

function formMonths<I extends {ctime: number; key: string}>(
  items: Array<I>
): Array<{
  key: string
  data: Array<I>
  month?: string
  year: number
}> {
  if (items.length === 0) {
    return []
  }
  const dateInfo = getDateInfo(items[0]!)
  let curMonth = {
    ...dateInfo,
    data: new Array<I>(),
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
  return (
    <Kb.Box2 direction="vertical" style={styles.thumbContainer}>
      <Kb.ClickableBox onClick={thumb.onClick} style={{...sizing.margins}}>
        {thumb.typ === ThumbTyp.AUDIO ? (
          <Kb.Box2 direction="vertical" style={{...sizing.dims}} centerChildren={true} gap="xtiny">
            <Kb.Box2 direction="vertical" centerChildren={true} style={styles.audioBackground}>
              <Kb.Icon
                type="iconfont-mic"
                style={{marginLeft: 2}}
                color={Kb.Styles.globalColors.whiteOrWhite}
                sizeType="Big"
              />
            </Kb.Box2>
            {!!thumb.audioDuration && (
              <Kb.Text type="BodyTiny">{formatAudioRecordDuration(thumb.audioDuration)}</Kb.Text>
            )}
          </Kb.Box2>
        ) : (
          <Kb.Image2 src={thumb.previewURL} style={{...sizing.dims}} />
        )}
      </Kb.ClickableBox>
      {thumb.typ === ThumbTyp.VIDEO && (
        <Kb.Box2 direction="vertical" style={styles.durationContainer}>
          <Kb.Icon type="icon-film-64" style={styles.filmIcon} />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

type DocViewRowProps = {item: Doc}

const DocViewRow = (props: DocViewRowProps) => {
  const {item} = props
  const shouldShow = React.useCallback(() => {
    return !!item.message
  }, [item])
  const {showPopup, popup} = useMessagePopup({
    ordinal: item.message?.ordinal ?? T.Chat.numberToOrdinal(0),
    shouldShow,
  })
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.ClickableBox onClick={item.onClick} onLongPress={showPopup}>
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
            Show in {Kb.Styles.fileUIName}
          </Kb.Text>
        </Kb.Box2>
      )}
      {Kb.Styles.isMobile && item.message && popup}
    </Kb.Box2>
  )
}

type SelectorProps = {
  selectedView: T.RPCChat.GalleryItemTyp
  onSelectView: (typ: T.RPCChat.GalleryItemTyp) => void
}

const getBkgColor = (selected: boolean) =>
  selected ? {backgroundColor: Kb.Styles.globalColors.blue} : {backgroundColor: undefined}
const getColor = (selected: boolean) =>
  selected ? {color: Kb.Styles.globalColors.white} : {color: Kb.Styles.globalColors.blueDark}

const AttachmentTypeSelector = (props: SelectorProps) => (
  <Kb.Box2 alignSelf="center" direction="horizontal" style={styles.selectorContainer} fullWidth={true}>
    <Kb.ClickableBox
      onClick={() => props.onSelectView(T.RPCChat.GalleryItemTyp.media)}
      style={Kb.Styles.collapseStyles([
        styles.selectorItemContainer,
        styles.selectorMediaContainer,
        getBkgColor(props.selectedView === T.RPCChat.GalleryItemTyp.media),
      ])}
    >
      <Kb.Text type="BodySemibold" style={getColor(props.selectedView === T.RPCChat.GalleryItemTyp.media)}>
        Media
      </Kb.Text>
    </Kb.ClickableBox>
    <Kb.ClickableBox
      onClick={() => props.onSelectView(T.RPCChat.GalleryItemTyp.doc)}
      style={Kb.Styles.collapseStyles([
        styles.selectorDocContainer,
        styles.selectorItemContainer,
        getBkgColor(props.selectedView === T.RPCChat.GalleryItemTyp.doc),
      ])}
    >
      <Kb.Text type="BodySemibold" style={getColor(props.selectedView === T.RPCChat.GalleryItemTyp.doc)}>
        Docs
      </Kb.Text>
    </Kb.ClickableBox>
    <Kb.ClickableBox
      onClick={() => props.onSelectView(T.RPCChat.GalleryItemTyp.link)}
      style={Kb.Styles.collapseStyles([
        styles.selectorItemContainer,
        styles.selectorLinkContainer,
        getBkgColor(props.selectedView === T.RPCChat.GalleryItemTyp.link),
      ])}
    >
      <Kb.Text type="BodySemibold" style={getColor(props.selectedView === T.RPCChat.GalleryItemTyp.link)}>
        Links
      </Kb.Text>
    </Kb.ClickableBox>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      audioBackground: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blue,
          padding: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          borderRadius: '50%',
        },
        isMobile: {
          borderRadius: 32,
        },
      }),
      avatar: {marginRight: Kb.Styles.globalMargins.tiny},
      container: {
        flex: 1,
        height: '100%',
      },
      docBottom: {padding: Kb.Styles.globalMargins.tiny},
      docIcon: {height: 32},
      docProgress: {alignSelf: 'center'},
      docRowContainer: {padding: Kb.Styles.globalMargins.tiny},
      docRowTitle: Kb.Styles.platformStyles({
        common: {flex: 1},
        isElectron: {
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        } as const,
      }),
      durationContainer: {
        alignSelf: 'flex-start',
        bottom: Kb.Styles.globalMargins.xtiny,
        position: 'absolute',
        right: Kb.Styles.globalMargins.xtiny,
      },
      filmIcon: {
        height: 16,
        width: 16,
      },
      flexWrap: {flexWrap: 'wrap'},
      linkContainer: {padding: Kb.Styles.globalMargins.tiny},
      linkStyle: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.black_50},
        isElectron: {
          fontSize: 13,
          lineHeight: 17,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        } as const,
        isMobile: {fontSize: 15},
      }),
      linkTime: {alignSelf: 'center'},
      loadMore: {margin: Kb.Styles.globalMargins.tiny},
      loadMoreProgress: {
        alignSelf: 'center',
        marginTop: Kb.Styles.globalMargins.tiny,
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
        padding: Kb.Styles.globalMargins.small,
      },
      selectorDocContainer: {
        borderColor: Kb.Styles.globalColors.blue,
        borderLeftWidth: 1,
        borderRadius: 0,
        borderRightWidth: 1,
      },
      selectorItemContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          ...Kb.Styles.globalStyles.flexBoxCenter,
          borderBottomWidth: 1,
          borderColor: Kb.Styles.globalColors.blue,
          borderStyle: 'solid',
          borderTopWidth: 1,
          flex: 1,
          height: 32,
        },
        isMobile: {paddingTop: Kb.Styles.globalMargins.xxtiny},
      }),
      selectorLinkContainer: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: Kb.Styles.borderRadius,
        borderRightWidth: 1,
        borderTopLeftRadius: 0,
        borderTopRightRadius: Kb.Styles.borderRadius,
      },
      selectorMediaContainer: {
        borderBottomLeftRadius: Kb.Styles.borderRadius,
        borderBottomRightRadius: 0,
        borderLeftWidth: 1,
        borderTopLeftRadius: Kb.Styles.borderRadius,
        borderTopRightRadius: 0,
      },
      thumbContainer: {
        overflow: 'hidden',
        position: 'relative',
      },
    }) as const
)

const linkStyleOverride = {
  link: Kb.Styles.collapseStyles([
    styles.linkStyle,
    {color: Kb.Styles.globalColors.blueDark},
  ]) as StylesTextCrossPlatform,
}

const getFromMsgID = (info: T.Chat.AttachmentViewInfo): T.Chat.MessageID | undefined => {
  if (info.last || info.status !== 'success') {
    return undefined
  }
  const lastMessage = info.messages.length > 0 ? info.messages.at(-1) : undefined
  return lastMessage?.id
}

export const useAttachmentSections = (
  p: Props,
  loadImmediately: boolean,
  useFlexWrap: boolean
): {sections: Array<Section>} => {
  const [selectedAttachmentView, onSelectAttachmentView] = React.useState<T.RPCChat.GalleryItemTyp>(
    T.RPCChat.GalleryItemTyp.media
  )
  const [lastSAV, setLastSAV] = React.useState(selectedAttachmentView)
  const loadAttachmentView = Chat.useChatContext(s => s.dispatch.loadAttachmentView)
  const loadMessagesCentered = Chat.useChatContext(s => s.dispatch.loadMessagesCentered)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)

  const jumpToAttachment = React.useCallback(
    (messageID: T.Chat.MessageID) => {
      if (C.isMobile) {
        clearModals()
      }
      loadMessagesCentered(messageID, 'always')
    },
    [loadMessagesCentered, clearModals]
  )

  C.useOnMountOnce(() => {
    setTimeout(() => {
      loadAttachmentView(selectedAttachmentView)
    }, 1)
  })

  React.useEffect(() => {
    if (lastSAV !== selectedAttachmentView) {
      setLastSAV(selectedAttachmentView)
      if (loadImmediately) {
        setTimeout(() => {
          loadAttachmentView(selectedAttachmentView)
        }, 1)
      }
    }
  }, [lastSAV, loadAttachmentView, loadImmediately, selectedAttachmentView])

  const attachmentView = Chat.useChatContext(s => s.attachmentViewMap)
  const attachmentInfo = attachmentView.get(selectedAttachmentView)
  const fromMsgID = attachmentInfo ? getFromMsgID(attachmentInfo) : undefined

  const onLoadMore = fromMsgID ? () => loadAttachmentView(selectedAttachmentView, fromMsgID) : undefined

  const onAttachmentViewChange = (viewType: T.RPCChat.GalleryItemTyp) => {
    onSelectAttachmentView(viewType)
  }

  const loadAttachments = () => {
    loadAttachmentView(selectedAttachmentView)
  }

  const attachmentPreviewSelect = Chat.useChatContext(s => s.dispatch.attachmentPreviewSelect)
  const onMediaClick = (message: T.Chat.MessageAttachment) => attachmentPreviewSelect(message.ordinal)

  const attachmentDownload = Chat.useChatContext(s => s.dispatch.attachmentDownload)
  const messageAttachmentNativeShare = Chat.useChatContext(s => s.dispatch.messageAttachmentNativeShare)

  const onDocDownload = (message: T.Chat.MessageAttachment) => {
    if (Kb.Styles.isMobile) {
      messageAttachmentNativeShare(message.ordinal)
    } else if (!message.downloadPath) {
      attachmentDownload(message.ordinal)
    }
  }

  const openLocalPathInSystemFileManagerDesktop = useFSState(
    s => s.dispatch.defer.openLocalPathInSystemFileManagerDesktop
  )
  const onShowInFinder = (message: T.Chat.MessageAttachment) =>
    message.downloadPath && openLocalPathInSystemFileManagerDesktop?.(message.downloadPath)

  const avSection = {
    data: [{type: 'avselector'}] as const,
    renderItem: () => (
      <AttachmentTypeSelector selectedView={selectedAttachmentView} onSelectView={onAttachmentViewChange} />
    ),
  } satisfies Section

  const commonSections: Array<Section> = [...(p.commonSections as Array<Section>), avSection]

  const loadMoreSection = {
    data: [{type: 'load-more'}] as const,
    renderItem: () => {
      const status = attachmentInfo?.status
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
  } satisfies Section

  let sections: Array<Section>
  if (!attachmentInfo?.messages.length && attachmentInfo?.status !== 'loading') {
    const noAttachmentsSection = {
      data: [{type: 'no-attachments'}] as const,
      renderItem: () => (
        <Kb.Box2 centerChildren={true} direction="horizontal" fullWidth={true}>
          <Kb.Text type="BodySmall">No attachments</Kb.Text>
        </Kb.Box2>
      ),
    } satisfies Section
    sections = [...commonSections, noAttachmentsSection, loadMoreSection]
  } else {
    switch (selectedAttachmentView) {
      case T.RPCChat.GalleryItemTyp.media:
        {
          const rowSize = 4 // count of images in each row
          const maxMediaThumbSize = infoPanelWidth() / rowSize
          const s: Array<Section> = formMonths(
            (attachmentInfo.messages as Array<T.Chat.MessageAttachment>).map(
              m =>
                ({
                  audioDuration: m.audioDuration,
                  ctime: m.timestamp,
                  height: m.previewHeight,
                  id: m.id,
                  key: `media-${m.ordinal}-${m.timestamp}-${m.previewURL}`,
                  onClick: () => onMediaClick(m),
                  previewURL: m.previewURL,
                  typ:
                    (m.audioAmps?.length ?? 0) > 0
                      ? ThumbTyp.AUDIO
                      : m.videoDuration
                        ? ThumbTyp.VIDEO
                        : ThumbTyp.IMAGE,
                  width: m.previewWidth,
                }) as Thumb
            )
          ).map(month => {
            const dataUnchunked = month.data.map(thumb => ({
              debug: {
                height: thumb.height,
                maxMediaThumbSize,
                width: thumb.width,
              },
              sizing: Chat.zoomImage(thumb.width, thumb.height, maxMediaThumbSize),
              thumb,
            }))
            const dataChunked = useFlexWrap ? [dataUnchunked] : chunk(dataUnchunked, rowSize)
            const data: ReadonlyArray<ThumbData> = dataChunked.map((images, i) => ({
              images,
              key: i,
              type: 'thumb',
            }))
            return {
              data,
              key: month.key,
              renderItem: ({item}: {item: Item; index: number}) =>
                item.type === 'thumb' ? (
                  <Kb.Box2
                    direction="horizontal"
                    fullWidth={true}
                    style={useFlexWrap ? styles.flexWrap : undefined}
                  >
                    {item.images.map(cell => {
                      return <MediaThumb key={cell.thumb.key} sizing={cell.sizing} thumb={cell.thumb} />
                    })}
                  </Kb.Box2>
                ) : null,
              renderSectionHeader: () => <Kb.SectionDivider label={`${month.month} ${month.year}`} />,
            } as const
          })
          sections = [...commonSections, ...s, loadMoreSection]
        }
        break
      case T.RPCChat.GalleryItemTyp.doc:
        {
          const docs: Array<Doc & {ctime: number; key: string}> = (
            attachmentInfo.messages as Array<T.Chat.MessageAttachment>
          ).map(m => ({
            author: m.author,
            ctime: m.timestamp,
            downloading: m.transferState === 'downloading',
            fileName: m.fileName,
            key: `doc-${m.ordinal}-${m.author}-${m.timestamp}-${m.fileName}`,
            message: m,
            name: m.title || m.fileName,
            onClick: () => {
              jumpToAttachment(m.id)
            },
            onDownload: () => onDocDownload(m),
            onShowInFinder: !C.isMobile && m.downloadPath ? () => onShowInFinder(m) : undefined,
            progress: m.transferProgress,
            type: 'doc',
          }))

          const s: Array<Section> = formMonths(docs).map(
            month =>
              ({
                data: month.data,
                key: month.key,
                renderItem: ({item}: {item: Item}) =>
                  item.type === 'doc' ? <DocViewRow item={item} /> : null,
                renderSectionHeader: () => <Kb.SectionDivider label={`${month.month} ${month.year}`} />,
              }) as const
          )
          sections = [...commonSections, ...s, loadMoreSection]
        }
        break
      case T.RPCChat.GalleryItemTyp.link:
        {
          const links = attachmentInfo.messages.reduce<Array<Link>>((l, m) => {
            if (m.type !== 'text') {
              return l
            }
            if (!m.unfurls?.size) {
              l.push({
                author: m.author,
                ctime: m.timestamp,
                id: m.id,
                key: `unfurl-empty-${m.ordinal}-${m.author}-${m.timestamp}`,
                snippet: m.decoratedText?.stringValue() ?? '',
                type: 'link',
              })
            } else {
              ;[...m.unfurls.values()].forEach((u, i) => {
                if (u.unfurl.unfurlType === T.RPCChat.UnfurlType.generic) {
                  l.push({
                    author: m.author,
                    ctime: m.timestamp,
                    id: m.id,
                    key: `unfurl-${m.ordinal}-${i}-${m.author}-${m.timestamp}-${u.unfurl.generic.url}`,
                    snippet: m.decoratedText?.stringValue() ?? '',
                    title: u.unfurl.generic.title,
                    type: 'link',
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
            renderItem: ({item}: {item: Item}) => {
              return item.type === 'link' ? (
                <Kb.ClickableBox2
                  onClick={() => {
                    jumpToAttachment(item.id)
                  }}
                >
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
                        style={Kb.Styles.collapseStyles([
                          styles.linkStyle,
                          {color: Kb.Styles.globalColors.blueDark},
                        ])}
                      >
                        {item.title}
                      </Kb.Text>
                    )}
                    <Kb.Divider />
                  </Kb.Box2>
                </Kb.ClickableBox2>
              ) : null
            },
            renderSectionHeader: () => <Kb.SectionDivider label={`${month.month} ${month.year}`} />,
          }))
          sections = [...commonSections, ...s, loadMoreSection]
        }
        break
    }
  }

  return {sections}
}

const Attachments = (p: Props) => {
  const {sections} = useAttachmentSections(p, true /* loadImmediately */, false /* flexWrap */)
  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({section}) => section.renderSectionHeader?.({section}) || null}
      sections={sections}
    />
  )
}
export default Attachments
