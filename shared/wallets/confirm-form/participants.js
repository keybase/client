// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import WalletEntry from './wallet-entry'

type Props = {|
  receiverUsername: string,
  receiverFullName: string,
  yourUsername: string,
  yourWalletName: string,
  yourWalletContents: string,
|}

const Participants = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        From:
      </Kb.Text>
      <WalletEntry
        keybaseUser={props.yourUsername}
        name={props.yourWalletName}
        contents={props.yourWalletContents}
      />
    </Kb.Box2>
    <Kb.Divider />
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        To:
      </Kb.Text>
      <Kb.Avatar size={32} style={Kb.avatarCastPlatformStyles(styles.avatar)} />
      <Kb.Box2 direction="vertical">
        <Kb.ConnectedUsernames type="BodySmall" usernames={[props.receiverUsername]} />
        <Kb.Text type="BodyTiny">{props.receiverFullName}</Kb.Text>
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
