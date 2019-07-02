import * as React from 'react'
import * as Constants from '../../../constants/wallets'
import {anyWaiting} from '../../../constants/waiting'
import * as Container from '../../../util/container'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import CalculateAdvancedButton from '../calculate-advanced-button'

const FooterAdvanced = () => {
  const builtPaymentAdvanced = Container.useSelector(state => state.wallets.builtPaymentAdvanced)
  const dispatch = Container.useDispatch()
  const onClickSendAdvanced = React.useCallback(() => dispatch(WalletsGen.createSendPaymentAdvanced()), [
    dispatch,
  ])
  return builtPaymentAdvanced.noPathFoundError ? (
    <Kb.Banner
      style={Styles.globalStyles.rounded}
      color="red"
      text="No path was found to convert these 2 assets. Please pick other assets."
    />
  ) : (
    <Kb.Box2
      direction="horizontal"
      alignItems="center"
      style={Styles.collapseStyles([Styles.globalStyles.rounded, styles.buttonBox])}
      fullWidth={true}
    >
      {builtPaymentAdvanced.sourceDisplay ? (
        <Kb.WaitingButton
          type="Wallet"
          label="Send"
          waitingKey={Constants.sendPaymentAdvancedWaitingKey}
          onClick={onClickSendAdvanced}
          disabled={!builtPaymentAdvanced.readyToSend}
          fullWidth={true}
        />
      ) : (
        <CalculateAdvancedButton isIcon={false} />
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  buttonBox: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueLighter3,
      justifyContent: 'center',
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
})

export default FooterAdvanced
