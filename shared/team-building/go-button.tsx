import * as Kb from '@/common-adapters/index'
import type * as T from '@/constants/types'

export type Props = {
  onClick: () => void
  label: T.TB.GoButtonLabel
  waitingKey?: string
}

const GoButton = (props: Props) => (
  <Kb.Box style={styles.container}>
    <Kb.WithTooltip
      tooltip={
        <Kb.Box2 direction="horizontal">
          <Kb.Icon
            type="iconfont-return"
            sizeType="Small"
            color={Kb.Styles.globalColors.white}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  button: {
    height: '100%',
  },
  container: {
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginTop: Kb.Styles.globalMargins.tiny,
  },
  go: Kb.Styles.platformStyles({
    common: {color: Kb.Styles.globalColors.white},
    isElectron: {lineHeight: 40},
  }),
  goIcon: Kb.Styles.platformStyles({
    isElectron: {
      lineHeight: 40,
    },
  }),
  goTooltipIcon: Kb.Styles.platformStyles({
    isElectron: {
      marginRight: Kb.Styles.globalMargins.xtiny,
      verticalAlign: 'middle',
    },
  }),
  goTooltipIconContainer: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.globalStyles.fullHeight,
    },
  }),
  hoverContainerStyle: Kb.Styles.platformStyles({
    isElectron: {
      justifyContent: 'center',
      width: '100%',
    },
  }),
}))

export default GoButton
