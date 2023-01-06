import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Styles from '../../../../styles'
import * as WalletConstants from '../../../../constants/wallets'
import shallowEqual from 'shallowequal'
import type * as Types from '../../../../constants/types/chat2'
import {ConvoIDContext} from '../ids-context'

export type ClaimProps = {
  amount: string
  label: string
  onClaim: () => void
}

export const useClaim = (ordinal: Types.Ordinal) => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const claimProps = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    return m?.type === 'text' ? getClaimProps(state, m) : undefined
  }, shallowEqual)
  const dispatch = Container.useDispatch()
  const onClaim = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']}))
  }, [dispatch])
  return claimProps ? <Claim {...claimProps} onClaim={onClaim} /> : null
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
  // TODO dont return this object
  return {amount, label}
}

const Claim = (props: ClaimProps) => {
  return (
    <Kb.Button type="Wallet" onClick={props.onClaim} small={true} style={styles.claimButton}>
      <Kb.Text style={styles.claimLabel} type="BodySemibold">
        {props.label}{' '}
        <Kb.Text style={styles.claimLabel} type="BodyExtrabold">
          {props.amount}
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
