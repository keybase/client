import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

export type Props = {
  onClick: () => void
  label: T.TB.GoButtonLabel
  waitingKey?: string
}

const GoButton = (props: Props) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Kb.WithTooltip
        tooltip={
          <Kb.Box2 direction="horizontal">
            <Kb.Icon
              type="iconfont-return"
              sizeType="Small"
              color={theme.white}
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
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  button: Kb.Styles.platformStyles({
    isElectron: {height: '100%', minWidth: 50, ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small)},
    isMobile: {height: '100%', minWidth: 80, ...Kb.Styles.paddingH(Kb.Styles.globalMargins.tiny)},
  }),
  container: {
    alignSelf: 'stretch',
    ...Kb.Styles.marginV(Kb.Styles.globalMargins.tiny),
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
