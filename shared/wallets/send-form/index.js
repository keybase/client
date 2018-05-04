// @flow
import * as React from 'react'
import {Box2} from '../../common-adapters'
import Body from './body/container'
import Footer from './footer/container'
import Header from './header/container'

type Props = {
  bannerInfo?: ?string,
  onClick: Function,
}

const SendForm = ({bannerInfo, onClick}: Props) => (
  <Box2 direction="vertical">
    <Header />
    <Body bannerInfo={null} />
    <Footer onClick={onClick} />
  </Box2>
)

export default SendForm
