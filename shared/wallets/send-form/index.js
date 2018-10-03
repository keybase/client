// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Body from './body/container'
import Header from './header'

type Props = {|
  isRequest: boolean,
  isProcessing?: boolean,
  onClose: () => void,
|}

const SendForm = (props: Props) => (
  <Kb.MaybePopup onClose={props.onClose}>
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Header />
      <Body isProcessing={props.isProcessing} isRequest={props.isRequest} />
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.textContainer}>
      <Kb.Text type="BodySmallSemibold" style={styles.textColor}>
        Powered by{' '}
        <Kb.Text
          type="BodySmallSemiboldSecondaryLink"
          isLink={true}
          onClickURL="https://stellar.org"
          style={styles.textColor}
        >
          stellar
        </Kb.Text>
      </Kb.Text>
    </Kb.Box2>
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      height: 525,
      width: 360,
    },
  }),
  textContainer: {
    position: 'absolute',
    textAlign: 'center',
    bottom: -26, // TODO: tweak this number, maybe make it calculated from the text's line height and a global margin
  },
  textColor: {
    color: Styles.globalColors.white_40,
  },
})

export default SendForm
