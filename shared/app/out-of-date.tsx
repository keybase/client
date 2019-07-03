import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import * as Types from '../constants/types/config'

type OwnProps = {}

type Props = {
  message: string
  onOpenAppStore: () => void
  status: Types.AppOutOfDateStatus
}

const OutOfDate = (p: Props) =>
  p.status !== 'critical' ? null : (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.container}>
      <Kb.Text center={true} type="Header" negative={true}>
        Your version of Keybase is critically out of date!
      </Kb.Text>
      <Kb.Box2 direction="vertical" style={styles.messageContainer} fullWidth={true}>
        <Kb.Markdown>{p.message}</Kb.Markdown>
      </Kb.Box2>
      {Styles.isMobile && <Kb.Button label="Update" onClick={p.onOpenAppStore} />}
    </Kb.Box2>
  )

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.red,
    bottom: undefined,
    padding: Styles.globalMargins.small,
    zIndex: 9999,
  },
  messageContainer: {
    backgroundColor: Styles.globalColors.white_90,
    borderRadius: Styles.borderRadius,
    padding: Styles.globalMargins.medium,
  },
})

const mapStateToProps = (state: Container.TypedState) => ({
  message: state.config.appOutOfDateMessage,
  status: state.config.appOutOfDateStatus,
})
const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onOpenAppStore: () => dispatch(ConfigGen.createOpenAppStore()),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => ({...stateProps, ...dispatchProps})
)(OutOfDate)
