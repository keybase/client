import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  onClick: () => void
  onDismiss: () => void
  onUnpin?: () => void
  text: string
}

const PinnedMessage = (props: Props) => {
  return props.text ? (
    <Kb.ClickableBox onClick={props.onClick} style={styles.container}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
        <Kb.Box2 direction="horizontal" style={styles.blueBar} />
        <Kb.Box2 direction="vertical" fullWidth={true} gap="xxtiny">
          <Kb.Text type="BodyTinySemibold" style={styles.label}>
            Pinned
          </Kb.Text>
          <Kb.Markdown smallStandaloneEmoji={true} lineClamp={2} style={styles.text}>
            {props.text}
          </Kb.Markdown>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ClickableBox>
  ) : null
}

const styles = Styles.styleSheetCreate({
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
    width: '100%',
  },
  label: {
    color: Styles.globalColors.blueDark,
  },
  text: {
    color: Styles.globalColors.black_50,
  },
})

export default PinnedMessage
