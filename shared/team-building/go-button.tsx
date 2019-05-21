import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'

export type Props = {
  onClick: () => void
}

const Go = () => (
  <Kb.Text type="BodyBig" style={styles.go}>
    Go!
  </Kb.Text>
)

const GoIcon = () => (
  <Kb.Icon
    type="iconfont-return"
    fontSize={16}
    color={Styles.globalColors.white}
    style={Kb.iconCastPlatformStyles(styles.goIcon)}
  />
)

const GoWithIconHover = Kb.HoverHoc(Go, GoIcon)

const GoButton = (props: Props) => (
  <Kb.ClickableBox onClick={() => props.onClick()} style={styles.container}>
    <GoWithIconHover />
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blue,
      ...Styles.globalStyles.rounded,
      marginLeft: Styles.globalMargins.tiny,
    },
    isElectron: {height: 40, width: 40},
  }),
  go: Styles.platformStyles({
    common: {color: Styles.globalColors.white},
    isElectron: {lineHeight: 40},
  }),

  goIcon: Styles.platformStyles({
    isElectron: {
      lineHeight: 40,
    },
  }),
})

export default GoButton
