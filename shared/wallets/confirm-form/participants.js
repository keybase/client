// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import WalletEntry from './wallet-entry'

type Props = {|
  receivingUsername: string,
  receivingFullName: string,
|}

const Participants = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        From:
      </Kb.Text>
      <WalletEntry
        accountID="G43289XXXXX34OPL"
        keybaseUser="cecileb"
        name="cecileb's wallet"
        contents="280.0871234 XLM"
      />
    </Kb.Box2>
    <Kb.Divider />
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        To:
      </Kb.Text>
      <Kb.Avatar size={32} style={Kb.avatarCastPlatformStyles(styles.avatar)} />
      <Kb.Box2 direction="vertical">
        <Kb.ConnectedUsernames type="BodySmall" usernames={[props.receivingUsername]} />
        <Kb.Text type="BodyTiny">{props.receivingFullName}</Kb.Text>
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
    paddingTop: Styles.globalMargins.tiny,
    paddingBottom: Styles.globalMargins.tiny,
    alignItems: 'center',
  },
  avatar: {
    marginRight: Styles.globalMargins.tiny,
  },
  headingText: Styles.platformStyles({
    common: {
      color: Styles.globalColors.blue,
    },
    isElectron: {
      marginRight: Styles.globalMargins.tiny,
    },
    isMobile: {
      width: 40,
      textAlign: 'right',
      marginRight: Styles.globalMargins.small,
    },
  }),
})

export default Participants
