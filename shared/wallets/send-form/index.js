// @flow
import * as React from 'react'
import {Box2} from '../../common-adapters'
import Body from './body/container'
import Header from './header/container'

type Props = {
  bannerInfo?: string,
  isProcessing?: boolean,
  onClick: Function,
}

const SendForm = ({bannerInfo, isProcessing, onClick}: Props) => (
  <Box2 direction="vertical">
    <Header />
    <Body bannerInfo={bannerInfo} isProcessing={isProcessing} onClick={onClick} />
  </Box2>
)

export default SendForm
