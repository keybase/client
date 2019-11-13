import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'

type Props = {
  message: Types.MessageSystemText
}

class SystemText extends React.PureComponent<Props> {
  render() {
    const {author, timestamp, text} = this.props.message
    return (
      <UserNotice username={author} bgColor={Styles.globalColors.blueLighter2} timestamp={timestamp}>
        <Kb.Text type="BodySmallSemibold" negative={true} style={styles.text}>
          {text.stringValue()}
        </Kb.Text>
      </UserNotice>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      text: Styles.platformStyles({
        common: {color: Styles.globalColors.black_50},
        isElectron: {wordBreak: 'break-word'} as const,
      }),
    } as const)
)

export default SystemText
