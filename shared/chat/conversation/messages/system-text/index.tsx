import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Text} from '../../../../common-adapters'
import UserNotice from '../user-notice'
import {globalColors, globalMargins} from '../../../../styles'
import SystemMessageTimestamp from '../system-message-timestamp'

type Props = {
  message: Types.MessageSystemText
}

class SystemText extends React.PureComponent<Props> {
  render() {
    const {author, timestamp, text} = this.props.message
    return (
      <UserNotice
        style={{marginTop: globalMargins.small}}
        username={author}
        bgColor={globalColors.blueLighter2}
      >
        <SystemMessageTimestamp timestamp={timestamp} />
        <Text type="BodySmallSemibold" negative={true} style={{color: globalColors.black_50}}>
          {text.stringValue()}
        </Text>
      </UserNotice>
    )
  }
}

export default SystemText
