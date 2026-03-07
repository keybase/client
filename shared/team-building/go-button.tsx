import * as Kb from '@/common-adapters/index'
import type * as T from '@/constants/types'

export type Props = {
  onClick: () => void
  label: T.TB.GoButtonLabel
  waitingKey?: string
}

const GoButton = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    <Kb.WithTooltip
      tooltip={
        <Kb.Box2 direction="horizontal">
          <Kb.Icon2
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
        label={props.label}
        onClick={props.onClick}
        style={styles.button}
        waitingKey={props.waitingKey}
      />
    </Kb.WithTooltip>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  button: Kb.Styles.platformStyles({
    isElectron: {height: '100%', minWidth: 50, paddingLeft: Kb.Styles.globalMargins.small, paddingRight: Kb.Styles.globalMargins.small},
    isMobile: {height: '100%', minWidth: 80, paddingLeft: Kb.Styles.globalMargins.tiny, paddingRight: Kb.Styles.globalMargins.tiny},
  }),
  container: {
    alignSelf: 'stretch',
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginTop: Kb.Styles.globalMargins.tiny,
  },
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
}))

export default GoButton
