// @flow
import * as React from 'react'
import {Box2, Divider, ProgressIndicator} from '../../../common-adapters'
import {globalStyles, styleSheetCreate} from '../../../styles'
import AssetInput from '../asset-input/container'
import Banner from '../../banner/container'
import Footer from '../footer/container'
import NoteAndMemo from '../note-and-memo/container'
import Participants from '../participants/container'
import type {Banner as BannerType} from '../../../constants/types/wallets'

type Props = {
  isRequest: boolean,
  banners: Array<BannerType>,
  isProcessing?: boolean,
}

const Spinner = () => (
  <Box2 direction="vertical" style={styles.spinnerContainer}>
    <ProgressIndicator type="Large" />
  </Box2>
)

const Body = ({banners, isProcessing, isRequest}: Props) => (
  <Box2 fullWidth={true} fullHeight={true} direction="vertical">
    {isProcessing && <Spinner />}
    {(banners || []).map(banner => (
      <Banner key={banner.bannerText} background={banner.bannerBackground} text={banner.bannerText} />
    ))}
    <Participants />
    <AssetInput />
    <Divider />
    <NoteAndMemo />
    <Footer isRequest={isRequest} />
  </Box2>
)

const styles = styleSheetCreate({
  spinnerContainer: {...globalStyles.fillAbsolute},
})

export default Body
