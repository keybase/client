// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Thumb = {|
  ctime: number,
  duration?: string,
  height: number,
  onClick: () => void,
  previewURL: string,
  width: number,
|}

type MediaProps = {|
  thumbs: Array<Thumb>,
  status: Types.AttachmentViewStatus,
|}

type Doc = {|
  author: string,
  ctime: number,
  downloading: boolean,
  name: string,
  progress: number,
  onDownload: null | (() => void),
  onShowInFinder: null | (() => void),
|}

type DocProps = {|
  docs: Array<Doc>,
  status: Types.AttachmentViewStatus,
|}

type Props = {|
  docs: DocProps,
  media: MediaProps,
  onViewChange: (RPCChatTypes.GalleryItemTyp, number) => void,
|}

type State = {|
  selectedView: RPCChatTypes.GalleryItemTyp,
|}

const rowSize = 4
const maxThumbSize = 80
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

const getDateInfo = thumb => {
  const date = new Date(thumb.ctime)
  return {
    month: monthNames[date.getMonth()],
    year: date.getFullYear(),
  }
}

const formMonths = thumbs => {
  if (thumbs.length === 0) {
    return []
  }
  let curMonth = {
    ...getDateInfo(thumbs[0]),
    data: [],
  }
  const months = thumbs.reduce((l, t, index) => {
    const dateInfo = getDateInfo(t)
    if (dateInfo.month !== curMonth.month || dateInfo.year !== curMonth.year) {
      if (curMonth.data.length > 0) {
        l.push(curMonth)
      }
      curMonth = {
        month: dateInfo.month,
        data: [t],
        year: dateInfo.year,
      }
    } else {
      curMonth.data.push(t)
    }
    if (index === thumbs.length - 1 && curMonth.data.length > 0) {
      l.push(curMonth)
    }
    return l
  }, [])
  return months
}

class MediaView extends React.Component<MediaProps> {
  _clamp = thumb => {
    return thumb.height > thumb.width
      ? {height: (maxThumbSize * thumb.height) / thumb.width, width: maxThumbSize}
      : {height: maxThumbSize, width: (maxThumbSize * thumb.width) / thumb.height}
  }
  _resize = thumb => {
    const dims = this._clamp(thumb)
    const marginHeight = dims.height > maxThumbSize ? (dims.height - maxThumbSize) / 2 : 0
    const marginWidth = dims.width > maxThumbSize ? (dims.width - maxThumbSize) / 2 : 0
    return {
      dims,
      margins: {
        marginBottom: -marginHeight,
        marginLeft: -marginWidth,
        marginRight: -marginWidth,
        marginTop: -marginHeight,
      },
    }
  }

  _formRows = thumbs => {
    let row = []
    return thumbs.reduce((l, t, index) => {
      if (index % rowSize === 0) {
        if (row.length > 0) {
          l.push(row)
        }
        row = []
      }
      row.push({
        sizing: this._resize(t),
        thumb: t,
      })
      if (index === thumbs.length - 1 && row.length > 0) {
        l.push(row)
      }
      return l
    }, [])
  }

  _finalizeMonth = month => {
    month.data = this._formRows(month.data)
    return month
  }

  _renderSectionHeader = ({section}) => {
    const label = `${section.month} ${section.year}`
    return <Kb.SectionDivider label={label} />
  }
  _renderRow = ({item, index}) => {
    return (
      <Kb.Box2 key={index} direction="horizontal" fullWidth={true} style={styles.mediaRowContainer}>
        {item.map((cell, index) => {
          return (
            <Kb.Box2 key={index} direction="vertical" style={styles.thumbContainer}>
              <Kb.ClickableBox onClick={cell.thumb.onClick} style={{...cell.sizing.margins}}>
                <Kb.Image src={cell.thumb.previewURL} style={{...cell.sizing.dims}} />
              </Kb.ClickableBox>
            </Kb.Box2>
          )
        })}
      </Kb.Box2>
    )
  }

  render() {
    const months = formMonths(this.props.media.thumbs).reduce((l, m) => {
      l.push(this._finalizeMonth(m))
      return l
    }, [])
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.SectionList
          stickySectionHeadersEnabled={true}
          renderSectionHeader={this._renderSectionHeader}
          keyboardShouldPersistTaps="handled"
          renderItem={this._renderRow}
          sections={months}
        />
      </Kb.Box2>
    )
  }
}

class DocView extends React.Component<DocProps> {
  _renderSectionHeader = ({section}) => {
    const label = `${section.month} ${section.year}`
    return <Kb.SectionDivider label={label} />
  }
  _renderItem = ({item, index}) => {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.ClickableBox onClick={item.onDownload}>
          <Kb.Box2
            key={index}
            direction="horizontal"
            fullWidth={true}
            style={styles.docRowContainer}
            gap="xtiny"
          >
            <Kb.Icon type={'icon-file-32'} style={Kb.iconCastPlatformStyles(styles.docIcon)} />
            <Kb.Box2 direction="vertical">
              <Kb.Text type="BodySemibold">{item.name}</Kb.Text>
              <Kb.Text type="BodySmall">Sent by {item.author}</Kb.Text>
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
      </Kb.Box2>
    )
  }
  render() {
    const months = formMonths(this.props.docs.docs)
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.SectionList
          stickySectionHeadersEnabled={true}
          renderSectionHeader={this._renderSectionHeader}
          keyboardShouldPersistTaps="handled"
          renderItem={this._renderItem}
          sections={months}
        />
      </Kb.Box2>
    )
  }
}

class AttachmentPanel extends React.Component<Props, State> {
  state = {selectedView: RPCChatTypes.localGalleryItemTyp.media}

  componentDidMount() {
    this.props.onViewChange(this.state.selectedView, this._getViewNum(this.state.selectedView))
  }

  _getButtonMode = typ => {
    return this.state.selectedView === typ ? 'Primary' : 'Secondary'
  }

  _getViewNum = view => {
    switch (view) {
      case RPCChatTypes.localGalleryItemTyp.media:
        return 50
      case RPCChatTypes.localGalleryItemTyp.link:
        return 20
      case RPCChatTypes.localGalleryItemTyp.doc:
        return 2
    }
    return 10
  }

  _selectView = view => {
    this.props.onViewChange(view, this._getViewNum(view))
    this.setState({selectedView: view})
  }

  render() {
    let content
    let isLoading = false
    switch (this.state.selectedView) {
      case RPCChatTypes.localGalleryItemTyp.media:
        content = <MediaView media={this.props.media} />
        isLoading = this.props.media.status === 'loading'
        break
      case RPCChatTypes.localGalleryItemTyp.doc:
        content = <DocView docs={this.props.docs} />
        isLoading = this.props.docs.status === 'loading'
        break
    }
    content = (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {isLoading && <Kb.ProgressIndicator style={styles.progress} />}
        {content}
      </Kb.Box2>
    )
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.ButtonBar direction="row" style={styles.buttons}>
          <Kb.Button
            type="Default"
            mode={this._getButtonMode(RPCChatTypes.localGalleryItemTyp.media)}
            label="Media"
            small={true}
            onClick={() => this._selectView(RPCChatTypes.localGalleryItemTyp.media)}
          />
          <Kb.Button
            type="Default"
            mode={this._getButtonMode(RPCChatTypes.localGalleryItemTyp.link)}
            label="Links"
            small={true}
            onClick={() => this._selectView(RPCChatTypes.localGalleryItemTyp.link)}
          />
          <Kb.Button
            type="Default"
            mode={this._getButtonMode(RPCChatTypes.localGalleryItemTyp.doc)}
            label="Docs"
            small={true}
            onClick={() => this._selectView(RPCChatTypes.localGalleryItemTyp.doc)}
          />
        </Kb.ButtonBar>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          {content}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
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
  mediaRowContainer: {
    minWidth: rowSize * maxThumbSize,
  },
  progress: {
    alignSelf: 'center',
    height: Styles.globalMargins.medium,
    width: Styles.globalMargins.medium,
  },
  thumbContainer: {
    overflow: 'hidden',
  },
})

export default AttachmentPanel
