// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import FileAttachment from './file/container'
import ImageAttachment from './image/container'

type Props = {|
  message: Types.MessageAttachment,
  toggleShowingMenu: () => void,
|}

class Attachment extends React.PureComponent<Props> {
  render() {
    if (this.props.message.attachmentType === 'image') {
      return <ImageAttachment message={this.props.message} toggleShowingMenu={this.props.toggleShowingMenu} />
    }
    return <FileAttachment message={this.props.message} toggleShowingMenu={this.props.toggleShowingMenu} />
  }
}

export default Attachment
