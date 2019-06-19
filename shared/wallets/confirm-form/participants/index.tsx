import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {ParticipantsRow, AccountEntry} from '../../common'
import {CounterpartyType, AccountID} from '../../../constants/types/wallets'

export type ParticipantsProps = {
  recipientType: CounterpartyType
  yourUsername: string
  fromAccountIsDefault: boolean
  fromAccountName: string
  fromAccountAssets: string
  recipientUsername: string
  recipientFullName: string
  // The below is needed only when recipientType !== 'keybaseUser'.
  recipientStellarAddress?: AccountID
  recipientAccountName?: string
  recipientAccountIsDefault?: boolean
  recipientAccountAssets?: string
}

const Participants = (props: ParticipantsProps) => {
  let toFieldContent

  switch (props.recipientType) {
    case 'keybaseUser':
      // A blank recipientUsername is the empty state, which we might be
      // in after a send, so just do nothing in that case.
      if (props.recipientUsername) {
        toFieldContent = (
          <Kb.ConnectedNameWithIcon
            colorFollowing={true}
            horizontal={true}
            username={props.recipientUsername}
            metaOne={props.recipientFullName}
            avatarStyle={styles.avatar}
            avatarSize={32}
            onClick="tracker"
          />
        )
      }
      break
    case 'stellarPublicKey':
      if (!props.recipientStellarAddress) {
        throw new Error('Recipient type stellarPublicKey requires prop recipientStellarAddress')
      }
      toFieldContent = (
        <Kb.Box2 direction="horizontal" gap="xtiny">
          <Kb.Icon type="iconfont-identity-stellar" style={Kb.iconCastPlatformStyles(styles.stellarIcon)} />
          <Kb.Text selectable={true} type="BodySemibold" style={styles.stellarAddressConfirmText}>
            {props.recipientStellarAddress}
          </Kb.Text>
        </Kb.Box2>
      )
      break
    case 'otherAccount':
      if (!props.recipientAccountName || !props.recipientAccountAssets) {
        throw new Error(
          'Recipient type otherAccount requires props recipientAccountName and recipientAccountAssets'
        )
      }
      toFieldContent = (
        <AccountEntry
          contents={props.recipientAccountAssets}
          isDefault={props.recipientAccountIsDefault}
          keybaseUser={props.yourUsername}
          name={props.recipientAccountName}
        />
      )
      break
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <ParticipantsRow heading="From">
        <AccountEntry
          contents={props.fromAccountAssets}
          isDefault={props.fromAccountIsDefault}
          keybaseUser={props.yourUsername}
          name={props.fromAccountName}
        />
      </ParticipantsRow>
      <ParticipantsRow heading="To" bottomDivider={false}>
        {toFieldContent}
      </ParticipantsRow>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  avatar: {
    marginRight: 8,
  },
  stellarAddressConfirmText: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  stellarIcon: {
    alignSelf: 'flex-start',
    marginRight: Styles.globalMargins.xxtiny,
  },
})

export default Participants
