import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'

type Label = 'Go!' | 'Add'

export type Props = {
  onClick: () => void
  label: Label
}

const Go = (label: Label) => () => (
  <Kb.Text type="BodyBig" style={styles.go}>
    {label}
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

const GoWithIconHover = Kb.HoverHoc(Go('Go!'), GoIcon)
const AddWithIconHover = Kb.HoverHoc(Go('Add'), GoIcon)

const GoButton = (props: Props) => (
  <Kb.ClickableBox onClick={() => props.onClick()} style={styles.container}>
    {props.label === 'Go!' ? <GoWithIconHover hoverContainerStyle={styles.hoverContainerStyle} /> : <AddWithIconHover hoverContainerStyle={styles.hoverContainerStyle} />}
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
  hoverContainerStyle: Styles.platformStyles({
    isElectron: {
      justifyContent: 'center',
      width: '100%',
    },
  }),
})

export default GoButton
