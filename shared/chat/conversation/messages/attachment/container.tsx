import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import FileAttachment from './file/container'
import ImageAttachment from './image/container'
import AudioAttachment from './audio'

type Props = {
  message: Types.MessageAttachment
  toggleMessageMenu: () => void
}

class Attachment extends React.PureComponent<Props> {
  render() {
    switch (this.props.message.attachmentType) {
      case 'image':
        return (
          <ImageAttachment message={this.props.message} toggleMessageMenu={this.props.toggleMessageMenu} />
        )
      case 'audio':
        return <AudioAttachment message={this.props.message} />
      default:
        return <FileAttachment message={this.props.message} />
    }
  }
}

export default Attachment
