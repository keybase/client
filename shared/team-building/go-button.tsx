import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import type {GoButtonLabel} from '../constants/types/team-building'

export type Props = {
  onClick: () => void
  label: GoButtonLabel
  waitingKey: string | null
}

const GoButton = (props: Props) => (
  <Kb.Box style={styles.container}>
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
      <Kb.WaitingButton
        type="Success"
        narrow={true}
        label={props.label}
        onClick={props.onClick}
        style={styles.button}
        waitingKey={props.waitingKey}
      />
    </Kb.WithTooltip>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(() => ({
  button: {
    height: '100%',
  },
  container: {
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
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
