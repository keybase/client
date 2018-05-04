// @flow
import * as React from 'react'
import {Divider, Box2} from '../../../common-adapters'
import AssetInput from '../asset-input'
import Banner from '../banner/container'
import Memo from '../memo/container'
import Note from '../note/container'
import Participants from '../participants/container'

type Props = {
  bannerInfo: ?string,
}

const Body = ({bannerInfo}: Props) => (
  <Box2 direction="vertical">
    (bannerInfo ?
    <Banner />
    : null)
    <Participants />
    <Divider />
    <AssetInput />
    <Memo />
    <Note />
  </Box2>
)

export default Body
