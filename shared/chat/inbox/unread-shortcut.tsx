import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  onClick: () => void
}

const UnreadShortcut = (props: Props) => (
  <Kb.ClickableBox onClick={props.onClick} style={styles.container}>
    <Kb.Box2
      direction="horizontal"
      gap="xtiny"
      centerChildren={true}
      fullWidth={true}
      style={styles.unreadShortcut}
    >
      <Kb.Icon type="iconfont-arrow-down" sizeType="Small" color={Styles.globalColors.white} />
      <Kb.Text negative={true} type="BodySmallSemibold">
        Unread messages
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate({
  container: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  unreadShortcut: {
    backgroundColor: Styles.globalColors.orange_90,
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
})

export default UnreadShortcut
