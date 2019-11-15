import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  message: Types.MessageSystemText
  onClickUserAvatar: (username: string) => void
}

class SystemText extends React.PureComponent<Props> {
  render() {
    const {text} = this.props.message
    return (
      <Kb.Text type="BodySmall" style={styles.text}>
        {text.stringValue()}
      </Kb.Text>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      text: Styles.platformStyles({
        isElectron: {wordBreak: 'break-word'} as const,
      }),
    } as const)
)

export default SystemText
