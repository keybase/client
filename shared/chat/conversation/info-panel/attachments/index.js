// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Kb from '../../../../common-adapters'

type Thumb = {|
  ctime: number,
  duration?: string,
  onClick: () => void,
  previewURL: string,
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

class MediaView extends React.Component<MediaProps> {
  render() {
    return (
      <Kb.Box2 direction="vertical">
        {this.props.media.thumbs.map(t => {
          return (
            <Kb.ClickableBox onClick={t.onClick}>
              <Kb.Image src={t.previewURL} style={{height: 50, width: 50}} />
            </Kb.ClickableBox>
          )
        })}
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
        <Kb.Box2 direction="vertical">{content}</Kb.Box2>
      </Kb.Box2>
    )
  }
}

export default AttachmentPanel
