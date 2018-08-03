// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {WalletRow} from '../../wallet-list/wallet-row'

type Props = {}

const Participants = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        From:
      </Kb.Text>
      <WalletRow
        isSelected={false}
        accountID="G43289XXXXX34OPL"
        keybaseUser="cecileb"
        name="cecileb's wallet"
        contents="280.0871234 XLM + more"
        onSelect={() => {}}
      />
    </Kb.Box2>
    <Kb.Divider />
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.row}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        To:
      </Kb.Text>
      <Kb.Avatar size={32} />
      <Kb.Box2 direction="vertical">
        <Kb.ConnectedUsernames type="BodySmall" usernames={['russel']} />
        <Kb.Text type="BodyTiny">Russel Smith</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    marginTop: Styles.globalMargins.tiny,
  },
  row: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: 7.5,
    paddingBottom: 7.5,
    alignItems: 'center',
  },
  headingText: {
    color: Styles.globalColors.blue,
  },
})

export default Participants
