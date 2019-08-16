import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  author: string
  onClick: () => void
  onDismiss: () => void
  onUnpin?: () => void
  text: string
}

const PinnedMessage = (props: Props) => {
  return props.text ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.container}>
      <Kb.ClickableBox onClick={props.onClick}>
        <Kb.Box2 direction="horizontal" style={styles.blueBar} />
        <Kb.Box2 direction="vertical" fullWidth={true} gap="xxtiny">
          <Kb.Text type="BodyTinySemibold" style={styles.label}>
            Pinned
          </Kb.Text>
          <Kb.Text type="BodySmallSemibold" style={styles.author}>
            {props.author}
          </Kb.Text>
          <Kb.Markdown smallStandaloneEmoji={true} lineClamp={2} selectable={true} style={styles.text}>
            {props.text}
          </Kb.Markdown>
        </Kb.Box2>
      </Kb.ClickableBox>
    </Kb.Box2>
  ) : null
}

const styles = Styles.styleSheetCreate({
  author: {
    color: Styles.globalColors.black,
  },
  blueBar: {
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.blue,
    width: Styles.globalMargins.xtiny,
  },
  container: {
    borderBottomWidth: 1,
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    left: 0,
    padding: Styles.globalMargins.tiny,
    position: 'absolute',
    top: 0,
  },
  label: {
    color: Styles.globalColors.blueDark,
  },
  text: {
    color: Styles.globalColors.black_50,
  },
})

export default PinnedMessage
