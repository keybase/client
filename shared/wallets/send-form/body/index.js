// @flow
import * as React from 'react'
import {Box2, Divider, ProgressIndicator} from '../../../common-adapters'
import {globalStyles, styleSheetCreate} from '../../../styles'
import AssetInput from '../asset-input/container'
import Banner from '../../banner'
import Footer from '../footer/container'
import NoteAndMemo from '../note-and-memo/container'
import Participants from '../participants/container'
import type {Banner as BannerType} from '../../../constants/types/wallets'

type Props = {
  isRequest: boolean,
  banners: Array<BannerType>,
  isProcessing?: boolean,
  onLinkAccount: () => void,
  onCreateNewAccount: () => void,
}

const Spinner = () => (
  <Box2 direction="vertical" style={styles.spinnerContainer}>
    <ProgressIndicator type="Large" />
  </Box2>
)

const Body = (props: Props) => (
  <Box2 fullWidth={true} fullHeight={true} direction="vertical">
    {props.isProcessing && <Spinner />}
    {props.banners.map(banner => (
      <Banner key={banner.bannerText} background={banner.bannerBackground} text={banner.bannerText} />
    ))}
    <Participants onLinkAccount={props.onLinkAccount} onCreateNewAccount={props.onCreateNewAccount} />
    <AssetInput />
    <Divider />
    <NoteAndMemo />
    <Footer isRequest={props.isRequest} />
  </Box2>
)

const styles = styleSheetCreate({
  spinnerContainer: {...globalStyles.fillAbsolute},
})

export default Body
