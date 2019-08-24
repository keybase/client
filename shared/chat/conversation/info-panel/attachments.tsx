import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {imgMaxWidthRaw} from '../messages/attachment/image/image-render'
import {formatTimeForMessages} from '../../../util/timestamp'
import MessagePopup from '../messages/message-popup'
import {chunk} from 'lodash-es'
import {OverlayParentProps} from '../../../common-adapters/overlay/parent-hoc'
import {Section} from '.'

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

type Thumb = {
  ctime: number
  height: number
  isVideo: boolean
  onClick: () => void
  previewURL: string
  width: number
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

type AttachmentItem = Thumb | Doc | Link

const _renderEmptyItem = item => (
  <Kb.Box2 centerChildren={true} direction="horizontal" fullWidth={true}>
    <Kb.Text type="BodySmall">{`No ${item}`}</Kb.Text>
  </Kb.Box2>
)

const getDateInfo = (thumb: AttachmentItem) => {
  const date = new Date(thumb.ctime)
  return {
    month: monthNames[date.getMonth()],
    year: date.getFullYear(),
  }
}

type Month = {
  data: Array<AttachmentItem>
  month: string
  year: number
}

const formMonths = (items: Array<AttachmentItem>): Array<Month> => {
  if (items.length === 0) {
    return []
  }
  let curMonth = {
    ...getDateInfo(items[0]),
    data: [] as Array<AttachmentItem>,
  }
  const months = items.reduce<Array<typeof curMonth>>((l, t, index) => {
    const dateInfo = getDateInfo(t)
    if (dateInfo.month !== curMonth.month || dateInfo.year !== curMonth.year) {
      if (curMonth.data.length > 0) {
        l.push(curMonth)
      }
      curMonth = {
        data: [t],
        month: dateInfo.month,
        year: dateInfo.year,
      }
    } else {
      curMonth.data.push(t)
    }
    if (index === items.length - 1 && curMonth.data.length > 0) {
      l.push(curMonth)
    }
    return l
  }, [])
  return months
}

const createLoadMoreSection = (
  onLoadMore: undefined | (() => void),
  onRetry: () => void,
  status: Types.AttachmentViewStatus
): Section => {
  return {
    data: ['load more'],
    renderItem: () => {
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
        return <Kb.ProgressIndicator style={styles.loadMoreProgress} />
      } else if (status === 'error') {
        return (
          <Kb.Button
            type="Danger"
            mode="Secondary"
            label="Error loading, try again"
            onClick={onRetry}
            style={styles.loadMore}
          />
        )
      }
      return null
    },
    renderSectionHeader: () => {
      return null
    },
  }
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

type ThumbSizing = {
  sizing: Sizing
  thumb: Thumb
}

type MediaThumbProps = {
  thumb: Thumb
  sizing: Sizing
}

type MediaThumbState = {
  loading: boolean
}

class MediaThumb extends React.Component<MediaThumbProps, MediaThumbState> {
  state = {loading: true}
  _setLoaded = () => {
    this.setState({loading: false})
  }
  render() {
    const {sizing, thumb} = this.props
    return (
      <Kb.Box2 direction="vertical" style={styles.thumbContainer}>
        <Kb.ClickableBox onClick={thumb.onClick} style={{...sizing.margins}}>
          <Kb.Image src={thumb.previewURL} style={{...sizing.dims}} onLoad={this._setLoaded} />
        </Kb.ClickableBox>
        {!!thumb.isVideo && (
          <Kb.Box2 direction="vertical" style={styles.durationContainer}>
            <Kb.Icon type="icon-film-64" style={Kb.iconCastPlatformStyles(styles.filmIcon)} />
          </Kb.Box2>
        )}
        {this.state.loading && <Kb.ProgressIndicator style={styles.loading} />}
      </Kb.Box2>
    )
  }
}

const rowSize = 4

export class MediaView {
  _resize = (thumb: Thumb) => {
    const maxThumbSize = Styles.isMobile ? imgMaxWidthRaw() / rowSize : 80
    return Constants.zoomImage(thumb.width, thumb.height, maxThumbSize)
  }

  _formRows = (thumbs: Array<Thumb>): Array<Array<ThumbSizing>> => {
    return chunk(thumbs.map(thumb => ({sizing: this._resize(thumb), thumb})), rowSize)
  }

  _monthToSection = (month: Month): Section => {
    return {
      data: this._formRows(month.data as Array<Thumb>),
      renderItem: this._renderRow,
      renderSectionHeader: ({section}) => this._renderSectionHeader(section, month.month, month.year),
    }
  }

  _renderSectionHeader = (_, month: string, year: number) => {
    const label = `${month} ${year}`
    return <Kb.SectionDivider label={label} />
  }
  _renderRow = ({item, index}) => {
    return (
      <Kb.Box2 key={index} direction="horizontal" fullWidth={true}>
        {item.map((cell, index) => {
          return <MediaThumb key={index} sizing={cell.sizing} thumb={cell.thumb} />
        })}
      </Kb.Box2>
    )
  }

  getSections = (
    thumbs: Array<Thumb>,
    onLoadMore: undefined | (() => void),
    onRetry: () => void,
    status: Types.AttachmentViewStatus
  ): Array<Section> => {
    if (thumbs.length === 0 && status !== 'loading')
      return [
        {
          data: ['media attachments'],
          renderItem: ({item}) => _renderEmptyItem(item),
          renderSectionHeader: () => null,
        },
      ]
    const sections = formMonths(thumbs).reduce<Array<Section>>((l, m) => {
      l.push(this._monthToSection(m))
      return l
    }, [])
    return sections.concat(createLoadMoreSection(onLoadMore, onRetry, status))
  }
}

type DocViewRowProps = {
  item: Doc
} & OverlayParentProps

class _DocViewRow extends React.Component<DocViewRowProps> {
  render() {
    const item = this.props.item
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.ClickableBox onClick={item.onDownload} onLongPress={this.props.toggleShowingMenu}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.docRowContainer} gap="xtiny">
            <Kb.Icon type={'icon-file-32'} style={Kb.iconCastPlatformStyles(styles.docIcon)} />
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
        {Styles.isMobile && this.props.showingMenu && item.message && (
          <MessagePopup
            attachTo={this.props.getAttachmentRef}
            message={item.message as Types.DecoratedMessage}
            onHidden={this.props.toggleShowingMenu}
            position="top right"
            visible={this.props.showingMenu}
          />
        )}
      </Kb.Box2>
    )
  }
}

const DocViewRow = Kb.OverlayParentHOC(_DocViewRow)

export class DocView {
  _renderSectionHeader = (_, month: string, year: number) => {
    const label = `${month} ${year}`
    return <Kb.SectionDivider label={label} />
  }
  _monthToSection = (month: Month): Section => {
    return {
      data: month.data,
      renderItem: this._renderItem,
      renderSectionHeader: ({section}) => this._renderSectionHeader(section, month.month, month.year),
    }
  }
  _renderItem = ({item}) => {
    return <DocViewRow item={item} />
  }
  getSections = (
    docs: Array<Doc>,
    onLoadMore: undefined | (() => void),
    onRetry: () => void,
    status: Types.AttachmentViewStatus
  ): Array<Section> => {
    if (docs.length === 0 && status !== 'loading')
      return [
        {
          data: ['documents'],
          renderItem: ({item}) => _renderEmptyItem(item),
          renderSectionHeader: () => null,
        },
      ]
    const sections = formMonths(docs).reduce<Array<Section>>((l, m) => {
      l.push(this._monthToSection(m))
      return l
    }, [])
    return sections.concat(createLoadMoreSection(onLoadMore, onRetry, status))
  }
}

export class LinkView {
  _renderSectionHeader = (_, month: string, year: number) => {
    const label = `${month} ${year}`
    return <Kb.SectionDivider label={label} />
  }
  _monthToSection = (month: Month): Section => {
    return {
      data: month.data,
      renderItem: this._renderItem,
      renderSectionHeader: ({section}) => this._renderSectionHeader(section, month.month, month.year),
    }
  }
  _renderItem = ({item}) => {
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
  }
  getSections = (
    links: Array<Link>,
    onLoadMore: undefined | (() => void),
    onRetry: () => void,
    status: Types.AttachmentViewStatus
  ): Array<Section> => {
    if (links.length === 0 && status !== 'loading')
      return [
        {
          data: ['links'],
          renderItem: ({item}) => _renderEmptyItem(item),
          renderSectionHeader: () => null,
        },
      ]
    const sections = formMonths(links).reduce<Array<Section>>((l, m) => {
      l.push(this._monthToSection(m))
      return l
    }, [])
    return sections.concat(createLoadMoreSection(onLoadMore, onRetry, status))
  }
}

type SelectorProps = {
  selectedView: RPCChatTypes.GalleryItemTyp
  onSelectView: (typ: RPCChatTypes.GalleryItemTyp) => void
}

export class AttachmentTypeSelector extends React.Component<SelectorProps> {
  _getBkgColor = typ => {
    return typ === this.props.selectedView
      ? {backgroundColor: Styles.globalColors.blue}
      : {backgroundColor: undefined}
  }
  _getColor = typ => {
    return typ === this.props.selectedView
      ? {color: Styles.globalColors.white}
      : {color: Styles.globalColors.blueDark}
  }
  render() {
    return (
      <Kb.Box2 direction="horizontal" style={styles.selectorContainer} fullWidth={true}>
        <Kb.ClickableBox
          onClick={() => this.props.onSelectView(RPCChatTypes.GalleryItemTyp.media)}
          style={Styles.collapseStyles([
            styles.selectorItemContainer,
            styles.selectorMediaContainer,
            this._getBkgColor(RPCChatTypes.GalleryItemTyp.media),
          ])}
        >
          <Kb.Text type="BodySemibold" style={this._getColor(RPCChatTypes.GalleryItemTyp.media)}>
            Media
          </Kb.Text>
        </Kb.ClickableBox>
        <Kb.ClickableBox
          onClick={() => this.props.onSelectView(RPCChatTypes.GalleryItemTyp.doc)}
          style={Styles.collapseStyles([
            styles.selectorDocContainer,
            styles.selectorItemContainer,
            this._getBkgColor(RPCChatTypes.GalleryItemTyp.doc),
          ])}
        >
          <Kb.Text type="BodySemibold" style={this._getColor(RPCChatTypes.GalleryItemTyp.doc)}>
            Docs
          </Kb.Text>
        </Kb.ClickableBox>
        <Kb.ClickableBox
          onClick={() => this.props.onSelectView(RPCChatTypes.GalleryItemTyp.link)}
          style={Styles.collapseStyles([
            styles.selectorItemContainer,
            styles.selectorLinkContainer,
            this._getBkgColor(RPCChatTypes.GalleryItemTyp.link),
          ])}
        >
          <Kb.Text type="BodySemibold" style={this._getColor(RPCChatTypes.GalleryItemTyp.link)}>
            Links
          </Kb.Text>
        </Kb.ClickableBox>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  avatar: {
    marginRight: Styles.globalMargins.tiny,
  },
  container: {
    flex: 1,
    height: '100%',
  },
  docBottom: {
    padding: Styles.globalMargins.tiny,
  },
  docIcon: {
    height: 32,
  },
  docProgress: {
    alignSelf: 'center',
  },
  docRowContainer: {
    padding: Styles.globalMargins.tiny,
  },
  docRowTitle: Styles.platformStyles({
    common: {
      flex: 1,
    },
    isElectron: {
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    },
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
  linkContainer: {
    padding: Styles.globalMargins.tiny,
  },
  linkStyle: Styles.platformStyles({
    common: {
      color: Styles.globalColors.black_50,
    },
    isElectron: {
      fontSize: 13,
      lineHeight: 17,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    },
    isMobile: {
      fontSize: 15,
    },
  }),
  linkTime: {
    alignSelf: 'center',
  },
  loadMore: {
    margin: Styles.globalMargins.tiny,
  },
  loadMoreProgress: {
    alignSelf: 'center',
    height: 16,
    marginTop: Styles.globalMargins.tiny,
    width: 16,
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
    isMobile: {
      paddingTop: Styles.globalMargins.xxtiny,
    },
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
})

const linkStyleOverride = {
  link: Styles.collapseStyles([styles.linkStyle, {color: Styles.globalColors.blueDark}]),
}
