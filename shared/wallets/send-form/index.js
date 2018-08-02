// @flow
import * as React from 'react'
import {Box2, Text, MaybePopup} from '../../common-adapters'
import * as Styles from '../../styles'
import Body from './body/container'
import Header from './header'

type Props = {|
  bannerInfo?: string,
  isProcessing?: boolean,
  onClick: () => void,
  onClose: () => void,
|}

const SendForm = (props: Props) => (
  <MaybePopup onClose={props.onClose}>
    <Box2 direction="vertical" style={styles.container}>
      <Header />
      <Body bannerInfo={props.bannerInfo} isProcessing={props.isProcessing} onClick={props.onClick} />
    </Box2>
    <Text type="BodySmallSemibold" style={Styles.collapseStyles([styles.text, styles.textColor])}>
      Powered by{' '}
      <Text
        type="BodySmallSemiboldInlineLink"
        isLink={true}
        onClickURL="https://stellar.org"
        style={styles.textColor}
      >
        stellar
      </Text>
    </Text>
  </MaybePopup>
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
