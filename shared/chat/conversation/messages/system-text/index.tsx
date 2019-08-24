import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import SystemMessageTimestamp from '../system-message-timestamp'

type Props = {
  message: Types.MessageSystemText
}

class SystemText extends React.PureComponent<Props> {
  render() {
    const {author, timestamp, text} = this.props.message
    return (
      <UserNotice style={styles.notice} username={author} bgColor={Styles.globalColors.blueLighter2}>
        <SystemMessageTimestamp timestamp={timestamp} />
        <Kb.Text type="BodySmallSemibold" negative={true} style={styles.text}>
          {text.stringValue()}
        </Kb.Text>
      </UserNotice>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  notice: {marginTop: Styles.globalMargins.small},
  text: Styles.platformStyles({
    common: {color: Styles.globalColors.black_50},
    isElectron: {wordBreak: 'break-word'},
  }),
}))

export default SystemText
