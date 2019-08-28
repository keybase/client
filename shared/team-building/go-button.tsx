import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'

type Label = 'Start' | 'Add'

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

const GoWithIconHover = Kb.HoverHoc(Go('Start'), GoIcon)
const AddWithIconHover = Kb.HoverHoc(Go('Add'), GoIcon)

const GoButton = (props: Props) => (
  <Kb.ClickableBox onClick={() => props.onClick()} style={styles.container}>
    <Kb.Box2 direction="vertical" fullHeight={true} centerChildren={true}>
      {props.label === 'Start' ? (
        <GoWithIconHover hoverContainerStyle={styles.hoverContainerStyle} />
      ) : (
        <AddWithIconHover hoverContainerStyle={styles.hoverContainerStyle} />
      )}
    </Kb.Box2>
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.green,
      ...Styles.globalStyles.rounded,
      marginLeft: Styles.globalMargins.tiny,
    },
    isElectron: {
      marginBottom: Styles.globalMargins.tiny,
      marginTop: Styles.globalMargins.tiny,
      width: 62,
    },
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
}))

export default GoButton
