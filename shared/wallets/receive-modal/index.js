// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import {globalMargins, isMobile, platformStyles, styleSheetCreate} from '../../styles'

type Props = {
  federatedAddress?: string,
  onClose: () => void,
  stellarAddress: string,
  username: string,
}

const ReceiveModal = (props: Props) => (
  <Kb.MaybePopup onClose={props.onClose}>
    <Kb.Box2 direction="vertical" style={containerStyle} centerChildren={true}>
      <Kb.Icon
        type={isMobile ? 'icon-wallet-receive-64' : 'icon-wallet-receive-48'}
        style={Kb.iconCastPlatformStyles(styles.icon)}
      />
      <Kb.Text type="BodySmallSemibold">{props.username}’s wallet</Kb.Text>
      <Kb.Text type="Header" style={styles.headerText}>
        Receive
      </Kb.Text>
      <Kb.Text type="Body" style={styles.instructionText}>
        To receive Lumens or assets from non-Keybase users, pass your Stellar addresses around:
      </Kb.Text>
      <Kb.Box2 direction="vertical" style={styles.stellarAddressContainer}>
        <Kb.CopyText text={props.stellarAddress} />
      </Kb.Box2>
      {!!props.federatedAddress && (
        <React.Fragment>
          <Kb.Text type="Body" style={styles.orText}>
            or
          </Kb.Text>
          <Kb.Box2 direction="vertical" style={styles.federatedAddressContainer}>
            <Kb.CopyText text={props.federatedAddress} />
          </Kb.Box2>
        </React.Fragment>
      )}
      <Kb.InfoNote>
        <Kb.Text type="BodySmall" style={styles.infoNoteText}>
          Use the chat interface to request Lumens from a Keybase user.
        </Kb.Text>
      </Kb.InfoNote>
      <Kb.Button label="Close" onClick={props.onClose} type="Secondary" />
    </Kb.Box2>
  </Kb.MaybePopup>
)

const styles = styleSheetCreate({
  federatedAddressContainer: {
    marginBottom: globalMargins.medium,
    width: '100%',
  },
  headerText: {
    marginBottom: globalMargins.medium,
  },
  icon: {
    marginBottom: globalMargins.small,
  },
  infoNoteText: {
    marginBottom: globalMargins.medium,
    maxWidth: 272,
    textAlign: 'center',
  },
  instructionText: {
    marginBottom: globalMargins.medium,
    textAlign: 'center',
  },
  orText: {
    marginBottom: globalMargins.tiny,
  },
  stellarAddressContainer: {
    marginBottom: globalMargins.tiny,
    width: '100%',
  },
})

const containerStyle = platformStyles({
  common: {
    alignItems: 'center',
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
  },
  isElectron: {
    height: 525,
    width: 360,
    paddingBottom: globalMargins.xlarge,
    paddingTop: globalMargins.xlarge,
    textAlign: 'center',
  },
  isMobile: {
    paddingBottom: globalMargins.medium,
    paddingTop: globalMargins.medium,
  },
})

export default ReceiveModal
