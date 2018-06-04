// @flow
import * as React from 'react'
import {Box2, Button, Icon, InfoNote, MaybePopup, Text} from '../../common-adapters'
import {globalMargins, styleSheetCreate} from '../../styles'

type Props = {
  onClose: () => void,
}

const ReceiveModal = (props: Props) => (
  <MaybePopup onClose={props.onClose}>
    <Box2 direction="vertical" style={styles.container}>
      <Icon type="icon-wallet-receive-48" style={{marginBottom: globalMargins.small}} />
      <Text type="BodySmallSemibold">cecileb’s wallet</Text>
      <Text type="Header" style={{marginBottom: globalMargins.medium}}>
        Receive
      </Text>
      <Text type="Body" style={{marginBottom: globalMargins.medium}}>
        To receive Lumens or assets from non-Keybase users, pass your Stellar addresses around:
      </Text>
      <Text type="Body">placeholder for new input</Text>
      <Text type="Body">or</Text>
      <Text type="Body">placeholder for new input</Text>
      <InfoNote>
        <Text type="BodySmallSemibold" style={styles.infoNoteText}>
          Use the chat interface to request Lumens from a Keybase user.
        </Text>
      </InfoNote>
      <Button label="Close" onClick={props.onClose} type="Secondary" />
    </Box2>
  </MaybePopup>
)

const styles = styleSheetCreate({
  container: {
    alignItems: 'center',
    maxWidth: 360,
    paddingBottom: globalMargins.xlarge,
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
    paddingTop: globalMargins.xlarge,
    textAlign: 'center',
  },
  infoNoteText: {
    marginBottom: globalMargins.medium,
    maxWidth: 272,
  },
})

export default ReceiveModal
