// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import * as Types from '../constants/types/config'

type OwnProps = {||}
type Props = {|
  reason: string,
  status: Types.AppOutOfDateStatus,
|}

const OutOfDate = (p: Props) => {
  return p.status !== 'critical' ? null : (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.container}>
      <Kb.Text center={true} type="Body">
        You version of Keybase is critically out of date!
      </Kb.Text>
      <Kb.Text center={true} type="BodySmall">
        {p.reason}
      </Kb.Text>
      <Kb.Button type="Primary" label="Update" click={p.onUpdate} />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.red,
    padding: Styles.globalMargins.small,
  },
})

const mapStateToProps = (state) => ({
  status: state.config.appOutOfDateStatus,
  reason: state.config.appOutOfDateReason,
})
const mapDispatchToProps = dispatch => ({
  onUpdate: dispatch(ConfigGen.createUpdateApp()),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({...stateProps, ...dispatchProps})

export default Container.connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(OutOfDate)
