// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import Row from '../../participants-row'
import WalletEntry from '../../wallet-entry'
import type {CounterpartyType} from '../../../constants/types/wallets'

export type Account = {|
  name: string,
  user: string,
  contents: string,
|}

/*

  yourUsername: string,
  yourAccountName: string,
  yourAccountContents: string,
  recipientUsername: ?string,
  recipientFullName: ?string,
  recipientStellarAddress: ?string,
  recipientAccountName: ?string,
  recipientAccountContents: ?string,
  recipientType: CounterpartyType,

*/

type ParticipantsProps = {|
  recipientType: CounterpartyType,
  yourUsername: string,
  fromAccountName: string,
  fromAccountContents: string,
  // Must have a recipient user, stellar address, or account
  recipientUsername?: string,
  recipientFullName?: string,
  recipientStellarAddress?: string,
  recipientAccountName?: string,
  recipientAccountContents?: string,
|}

const Participants = (props: ParticipantsProps) => {
  let toFieldContent

  switch (props.recipientType) {
    case 'keybaseUser':
      if (!props.recipientUsername || !props.recipientFullName) {
        throw new Error('Recipient type keybaseUser requires props recipientUsername and recipientFullName')
      }
      toFieldContent = (
        <Kb.NameWithIcon
          colorFollowing={true}
          horizontal={true}
          username={props.recipientUsername}
          metaOne={props.recipientFullName}
          avatarStyle={styles.avatar}
        />
      )
      break
    case 'stellarPublicKey':
      if (!props.recipientStellarAddress) {
        throw new Error('Recipient type stellarPublicKey requires prop recipientStellarAddress')
      }
      toFieldContent = (
        <React.Fragment>
          <Kb.Icon type="icon-stellar-logo-16" style={Kb.iconCastPlatformStyles(styles.stellarIcon)} />
          <Kb.Text type="BodySemibold" style={styles.stellarAddressConfirmText}>
            {props.recipientStellarAddress}
          </Kb.Text>
        </React.Fragment>
      )
      break
    case 'otherAccount':
      if (!props.recipientAccountName || !props.recipientAccountContents) {
        throw new Error(
          'Recipient type otherAccount requires props recipientAccountName and recipientAccountContents'
        )
      }
      toFieldContent = (
        <WalletEntry
          keybaseUser={props.yourUsername}
          name={props.recipientAccountName}
          contents={props.recipientAccountContents}
        />
      )
      break
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Row heading="From:">
        <WalletEntry
          keybaseUser={props.yourUsername}
          name={props.fromAccountName}
          contents={props.fromAccountContents}
        />
      </Row>
      <Row heading="To:" bottomDivider={false}>
        {toFieldContent}
      </Row>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  stellarIcon: {
    alignSelf: 'flex-start',
    marginRight: Styles.globalMargins.xxtiny,
  },
  stellarAddressConfirmText: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  avatar: {
    marginRight: 8,
  },
})

export default Participants
