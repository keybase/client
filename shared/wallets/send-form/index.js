// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Body from './body/container'
import Header from './header'

type Props = {|
  isRequest: boolean,
  bannerInfo?: string,
  isProcessing?: boolean,
  onClick: () => void,
  onClose: () => void,
|}

const SendForm = (props: Props) => (
  <Kb.MaybePopup onClose={props.onClose}>
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Header />
      <Body bannerInfo={props.bannerInfo} isProcessing={props.isProcessing} onClick={props.onClick} />
    </Kb.Box2>
    <Kb.Text type="BodySmallSemibold" style={Styles.collapseStyles([styles.text, styles.textColor])}>
      Powered by{' '}
      <Kb.Text
        type="BodySmallSemiboldInlineLink"
        isLink={true}
        onClickURL="https://stellar.org"
        style={styles.textColor}
      >
        stellar
      </Kb.Text>
    </Kb.Text>
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      height: 525,
      width: 360,
    },
  }),
  text: {
    position: 'relative',
    textAlign: 'center',
    top: 20,
  },
  textColor: {
    color: Styles.globalColors.white_40,
  },
})

export default SendForm
