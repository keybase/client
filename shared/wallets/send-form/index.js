// @flow
import * as React from 'react'
import {Box2} from '../../common-adapters'
import Body from './body'
import Footer from './footer'
import Header from './header'

type Props = {
  bannerInfo?: ?string,
  onClick: Function,
  skeleton: null,
}

const SendForm = ({bannerInfo, onClick, skeleton}: Props) => (
  <Box2 direction="vertical">
    <Header skeleton={skeleton} />
    <Body skeleton={skeleton} bannerInfo={null} />
    <Footer skeleton={skeleton} onClick={onClick} />
  </Box2>
)

export default SendForm
