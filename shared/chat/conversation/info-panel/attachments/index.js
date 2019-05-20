// @flow
import * as React from 'react'

type MediaProps = {|
  ctime: number,
  duration?: string,
  onClick: () => void,
  previewURL: string,
|}

type DocProps = {|
  author: string,
  ctime: number,
  name: string,
  onDownload: () => void,
|}

type Props = {|
  docs: Array<DocProps>,
  isError: boolean,
  media: Array<MediaProps>,
  onViewChange: RPCChatTypes.GalleryItemTyp => void,
|}

type State = {|
  selectedView: RPCChatTypes.GalleryItemTyp,
|}

class AttachmentView extends React.Component<Props, State> {}
