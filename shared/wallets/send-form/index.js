// @flow
import * as React from 'react'
import {Box2, Text} from '../../common-adapters'
import {styleSheetCreate} from '../../styles'
import Body from './body/container'
import Header from './header'

type Props = {
  bannerInfo?: string,
  isProcessing?: boolean,
  onClick: Function,
}

const SendForm = ({bannerInfo, isProcessing, onClick}: Props) => (
  <Box2 direction="vertical" style={styles.container}>
    <Header />
    <Body bannerInfo={bannerInfo} isProcessing={isProcessing} onClick={onClick} />
    <Text type="BodySmallSemibold" style={styles.text}>
      Powered by{' '}
      <Text type="BodySmallSemiboldInlineLink" isLink={true} onClickURL="https://stellar.org">
        stellar
      </Text>
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    maxWidth: 360,
  },
  text: {
    position: 'relative',
    textAlign: 'center',
    top: 20,
  },
})

export default SendForm
