// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
// import moment from 'moment'
// import {Box, Icon, ProgressIndicator, Text, ClickableBox} from '../../../../common-adapters'
// import {isMobile, fileUIName} from '../../../../constants/platform'
// import {globalStyles, globalMargins, globalColors} from '../../../../styles'
import {imgMaxWidth} from './image'
// import {ImageRender, imgMaxWidth} from './image'

// const maxWidth = imgMaxWidth()

type Props = {
  message: Types.MessageAttachment,
}

class Attachment extends React.PureComponent<Props> {
  render() {
    return null // <ImageRender src={message.}/>
  }
}

export default Attachment
