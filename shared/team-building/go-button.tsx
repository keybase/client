import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {GoButtonLabel} from '../constants/types/team-building'

export type Props = {
  onClick: () => void
  label: GoButtonLabel
}

const Go = (props: {label: GoButtonLabel}) => (
  <Kb.Text type="BodyBig" style={styles.go}>
    {props.label}
  </Kb.Text>
)

const GoButton = (props: Props) => (
  <Kb.ClickableBox onClick={() => props.onClick()} style={styles.container}>
    <Kb.WithTooltip
      tooltip={
        <Kb.Box2 direction="horizontal">
          <Kb.Icon
            type="iconfont-return"
            sizeType="Small"
            color={Styles.globalColors.white}
            style={styles.goTooltipIcon}
          />
          Enter
        </Kb.Box2>
      }
      containerStyle={styles.goTooltipIconContainer}
    >
      <Kb.Box2 direction="vertical" fullHeight={true} centerChildren={true}>
        <Go label={props.label} />
      </Kb.Box2>
    </Kb.WithTooltip>
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
  goTooltipIcon: Styles.platformStyles({
    isElectron: {
      marginRight: Styles.globalMargins.xtiny,
      verticalAlign: 'middle',
    },
  }),
  goTooltipIconContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fullHeight,
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
