// @flow
import * as React from 'react'
import {Divider, Box2} from '../../../common-adapters'
import AssetInput from '../asset-input'
import Banner from '../banner/container'
import Footer from '../footer/container'
import Memo from '../memo/container'
import Note from '../note/container'
import Participants from '../participants/container'

type Props = {
  bannerInfo?: string,
  isProcessing?: boolean,
  onClick: Function,
}

const Spinner = () => <Box2 direction="vertical">Spinner</Box2>

const Body = ({bannerInfo, isProcessing, onClick}: Props) => (
  <Box2 direction="vertical">
    (isProcessing ?
    <Spinner />
    : null) (bannerInfo ?
    <Banner />
    : null)
    <Participants />
    <Divider />
    <AssetInput />
    <Memo />
    <Note />
    <Footer onClick={onClick} />
  </Box2>
)

export default Body
