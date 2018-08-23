// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {|
  accountName: string,
  onAccept: () => void,
  onClose: () => void,
  username: string,
|}

const SetDefaultAccount = (props: Props) => (
  <Kb.MaybePopup onClose={props.onClose}>
    <Kb.Box2
      gap="mediumLarge"
      centerChildren={Styles.isMobile}
      gapStart={!Styles.isMobile}
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      style={styles.container}
    >
      {Styles.isMobile && <Kb.HeaderHocHeader onCancel={props.onClose} headerStyle={styles.header} />}
      <Kb.Box style={{position: 'relative'}}>
        <Kb.Icon type="icon-wallet-48" />
        <Kb.Avatar size={32} username={props.username} style={Kb.avatarCastPlatformStyles(styles.avatar)} />
      </Kb.Box>
      <Kb.Text type="Header" style={styles.textAlignCenter}>
        Set{' '}
        <Kb.Text type="Header" style={styles.textItalic}>
          {props.accountName}
        </Kb.Text>{' '}
        as your default Keybase account?
      </Kb.Text>
      <Kb.Text type="Body" style={styles.textAlignCenter}>
        All transactions and overall activity with{' '}
        <Kb.Text type="Body" style={styles.textItalic}>
          {props.accountName}
        </Kb.Text>{' '}
        will now be tied to your Keybase identity. Your account's name remains encrypted and only visible to
        you.
      </Kb.Text>
      <Kb.ButtonBar direction={Styles.isMobile ? 'column' : 'row'} style={styles.buttonBar}>
        <Kb.Button type="Secondary" style={styles.button} onClick={props.onClose} label="Cancel" />
        <Kb.Button
          type="Wallet"
          style={styles.button}
          onClick={props.onAccept}
          label="Set as default account"
        />
      </Kb.ButtonBar>
    </Kb.Box2>
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  avatar: Styles.platformStyles({
    common: {
      position: 'absolute',
    },
    isElectron: {
      left: -12,
      top: 26,
    },
    isMobile: {
      left: -8,
      top: 12,
    },
  }),
  button: Styles.platformStyles({
    isMobile: {
      width: '100%',
    },
  }),
  buttonBar: Styles.platformStyles({
    isElectron: {
      bottom: 50,
      position: 'absolute',
    },
    isMobile: {
      bottom: 16,
      left: 16,
      position: 'absolute',
      right: 1,
    },
  }),
  container: Styles.platformStyles({
    common: {
      alignItems: 'center',
      padding: Styles.globalMargins.medium,
      position: 'relative',
    },
    isElectron: {
      height: 525,
      width: 360,
    },
  }),
  header: {
    borderBottomWidth: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  textAlignCenter: {
    textAlign: 'center',
  },
  textItalic: {
    fontStyle: 'italic',
  },
})

export default SetDefaultAccount
