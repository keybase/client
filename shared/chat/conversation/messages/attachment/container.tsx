import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import FileAttachment from './file/container'
import ImageAttachment from './image/container'
import AudioAttachment from './audio'

type Props = {
  message: Types.MessageAttachment
  toggleMessageMenu: () => void
}

const Attachment = React.memo((props: Props) => {
  const {message, toggleMessageMenu} = props
  switch (message.attachmentType) {
    case 'image':
      return <ImageAttachment message={message} toggleMessageMenu={toggleMessageMenu} />
    case 'audio':
      return <AudioAttachment message={message} />
    default:
      return <FileAttachment message={message} />
  }
})

export default Attachment
