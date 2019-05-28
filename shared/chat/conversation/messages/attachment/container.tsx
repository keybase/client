import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import FileAttachment from './file/container'
import ImageAttachment from './image/container'

type Props = {
  message: Types.MessageAttachment
  toggleMessageMenu: () => void
}

class Attachment extends React.PureComponent<Props> {
  render() {
    if (this.props.message.attachmentType === 'image') {
      return <ImageAttachment message={this.props.message} toggleMessageMenu={this.props.toggleMessageMenu} />
    }
    return <FileAttachment message={this.props.message} />
  }
}

export default Attachment
