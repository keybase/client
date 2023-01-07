import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Styles from '../../../../styles'
import * as WalletConstants from '../../../../constants/wallets'
import shallowEqual from 'shallowequal'
import type * as Types from '../../../../constants/types/chat2'
import {ConvoIDContext, OrdinalContext} from '../ids-context'

export const useClaim = (ordinal: Types.Ordinal) => {
  const conversationIDKey = React.useContext(ConvoIDContext)

  const showClaim = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const paymentInfo =
      (m?.type === 'text' || m?.type === 'sendPayment') && Constants.getPaymentMessageInfo(state, m)
    return !!paymentInfo
  })
  return showClaim ? <Claim /> : null
}

const getClaimProps = (state: Container.TypedState, message: Types.MessageText) => {
  const paymentInfo = Constants.getPaymentMessageInfo(state, message)
  if (!paymentInfo) {
    return undefined
  }

  const youAreSender = message.author === state.config.username
  const cancelable = paymentInfo.status === 'claimable'
  const acceptedDisclaimer = WalletConstants.getAcceptedDisclaimer(state)
  if (youAreSender || !cancelable || acceptedDisclaimer) {
    return undefined
  }
  const label = `Claim${paymentInfo.worth ? ' Lumens worth' : ''}`
  const amountDescription = paymentInfo.sourceAmount
    ? `${paymentInfo.amountDescription}/${paymentInfo.issuerDescription}`
    : paymentInfo.amountDescription
  const amount = paymentInfo.worth ? paymentInfo.worth : amountDescription
  return {amount, label}
}

const Claim = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const dispatch = Container.useDispatch()
  const onClaim = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']}))
  }, [dispatch])
  const info = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    return m?.type === 'text' ? getClaimProps(state, m) : undefined
  }, shallowEqual)
  if (!info) return null
  const {amount, label} = info
  return (
    <Kb.Button type="Wallet" onClick={onClaim} small={true} style={styles.claimButton}>
      <Kb.Text style={styles.claimLabel} type="BodySemibold">
        {label}{' '}
        <Kb.Text style={styles.claimLabel} type="BodyExtrabold">
          {amount}
        </Kb.Text>
      </Kb.Text>
    </Kb.Button>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      claimButton: {
        alignSelf: 'flex-start',
        marginTop: Styles.globalMargins.xtiny,
      },
      claimLabel: {color: Styles.globalColors.white},
    } as const)
)

export default Claim
