// @flow
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as SettingsTabs from '../../../constants/settings'
import * as Tabs from '../../../constants/tabs'
import PaymentsConfirm from '.'
import {namedConnect} from '../../../util/container'

type OwnProps = {||}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const pinfo = state.chat2.paymentConfirmInfo
  const payments = pinfo?.summary?.payments || []
  return {
    displayTotal: pinfo?.summary?.displayTotal,
    error: pinfo?.error,
    loading: !pinfo,
    payments,
    xlmTotal: pinfo?.summary?.xlmTotal,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onAccept: () => {
    dispatch(Chat2Gen.createConfirmScreenResponse({accept: true}))
  },
  onCancel: () => {
    dispatch(Chat2Gen.createConfirmScreenResponse({accept: false}))
  },
  onWallet: () =>
    dispatch(
      RouteTreeGen.createNavigateTo({
        path: Container.isMobile ? [Tabs.settingsTab, SettingsTabs.walletsTab] : [Tabs.walletsTab],
      })
    ),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'PaymentsConfirm'
)(PaymentsConfirm)
