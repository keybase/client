// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type PaymentProps = {|
  username: string,
  fullName: string,
  xlmAmount: string,
  displayAmount: ?string,
|}

type Props = {|
  onAccept: () => void,
  onCancel: () => void,
  loading: boolean,
  xlmTotal: string,
  displayTotal: string,
|}

const PaymentsConfirm = (props: Props) => (
  <Kb.MaybePopup onClose={props.onCancel}>
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container} />
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  container: {},
})
