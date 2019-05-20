// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Constants from '../../../../constants/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {delegateUiCtlRegisterIdentifyUIRpcPromise} from '../../../../constants/types/rpc-gen'

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
  name: string,
  onDownload: () => void,
|}

type DocProps = {|
  docs: Array<Doc>,
  status: Types.AttachmentViewStatus,
|}

type Props = {|
  docs: DocProps,
  media: MediaProps,
  onViewChange: RPCChatTypes.GalleryItemTyp => void,
|}

type State = {|
  selectedView: RPCChatTypes.GalleryItemTyp,
|}

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
        marginTop: -marginHeight,
        marginBottom: -marginHeight,
        marginLeft: -marginWidth,
        marginRight: -marginWidth,
      },
    }
  }

  _formRows = thumbs => {
    const rowSize = 4
    let row = []
    const rows = thumbs.reduce((l, t, index) => {
      if (index % rowSize === 0) {
        if (row.length > 0) {
          l.push(row)
        }
        row = []
      }
      const sizing = this._resize(t)
      row.push(
        <Kb.ClickableBox onClick={t.onClick} style={{...sizing.margins}}>
          <Kb.Image src={t.previewURL} style={{...sizing.dims}} />
        </Kb.ClickableBox>
      )
      if (index === thumbs.length - 1 && row.length > 0) {
        l.push(row)
      }
      return l
    }, [])
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {rows.map((row, index) => {
          return (
            <Kb.Box2 key={index} direction="horizontal" fullWidth={true}>
              {row.map((thumb, index) => {
                return (
                  <Kb.Box2 key={index} direction="vertical" style={styles.thumbContainer}>
                    {thumb}
                  </Kb.Box2>
                )
              })}
            </Kb.Box2>
          )
        })}
      </Kb.Box2>
    )
  }

  _getDateInfo = thumb => {
    const date = new Date(thumb.ctime)
    return {
      month: monthNames[date.getMonth()],
      year: date.getFullYear(),
    }
  }

  _formMonths = thumbs => {
    if (thumbs.length === 0) {
      return []
    }
    let curMonth = {
      ...this._getDateInfo(thumbs[0]),
      data: [[]],
    }
    const months = thumbs.reduce((l, t, index) => {
      const dateInfo = this._getDateInfo(t)
      if (dateInfo.month !== curMonth.month || dateInfo.year !== curMonth.year) {
        if (curMonth.data.length > 0) {
          l.push(curMonth)
        }
        curMonth = {
          data: [[t]],
          month: dateInfo.month,
          year: dateInfo.year,
        }
      } else {
        curMonth.data[0].push(t)
      }
      if (index === thumbs.length - 1 && curMonth.data.length > 0) {
        l.push(curMonth)
      }
      return l
    }, [])
    return months
  }

  _renderSectionHeader = ({section}) => {
    const label = `${section.month} ${section.year}`
    return <Kb.SectionDivider label={label} />
  }
  _renderMonth = ({section}) => {
    return this._formRows(section.data[0])
  }

  render() {
    const months = this._formMonths(this.props.media.thumbs)
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.SectionList
          stickySectionHeadersEnabled={true}
          renderSectionHeader={this._renderSectionHeader}
          keyboardShouldPersistTaps="handled"
          renderItem={this._renderMonth}
          sections={months}
        />
      </Kb.Box2>
    )
  }
}

class DocView extends React.Component<DocProps> {
  render() {
    return null
  }
}

class AttachmentPanel extends React.Component<Props, State> {
  state = {selectedView: RPCChatTypes.localGalleryItemTyp.media}

  componentDidMount() {
    this.props.onViewChange(this.state.selectedView)
  }

  render() {
    let content
    switch (this.state.selectedView) {
      case RPCChatTypes.localGalleryItemTyp.media:
        content = <MediaView media={this.props.media} />
        break
      case RPCChatTypes.localGalleryItemTyp.docs:
        content = <DocView docs={this.props.docs} />
        break
    }
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
        <Kb.ButtonBar direction="row">
          <Kb.Button type="Default" mode="Secondary" small={true} label="Media" />
          <Kb.Button type="Default" mode="Secondary" small={true} label="Docs" />
        </Kb.ButtonBar>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          {content}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  thumbContainer: {
    overflow: 'hidden',
  },
})

export default AttachmentPanel
