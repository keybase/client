import * as React from 'react'
import type * as T from '../../../../constants/types'
import * as Kb from '../../../../common-adapters'
import UserNotice from '../user-notice'

type Props = {
  message: T.Chat.MessageSystemText
}

class SystemText extends React.PureComponent<Props> {
  render() {
    const {text} = this.props.message
    return (
      <UserNotice>
        <Kb.Text type="BodySmall" style={styles.text}>
          {text.stringValue()}
        </Kb.Text>
      </UserNotice>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      text: Kb.Styles.platformStyles({
        isElectron: {wordBreak: 'break-word'} as const,
      }),
    }) as const
)

export default SystemText
