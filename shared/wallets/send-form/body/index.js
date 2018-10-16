// @flow
import * as React from 'react'
import {Box2, Divider, ProgressIndicator} from '../../../common-adapters'
import {globalStyles, styleSheetCreate} from '../../../styles'
import AssetInput from '../asset-input/container'
import Banner from '../../banner'
import Footer from '../footer/container'
import {SecretNote, PublicMemo} from '../note-and-memo/container'
import Participants from '../participants/container'
import type {Banner as BannerType} from '../../../constants/types/wallets'

type SendBodyProps = {
  banners: Array<BannerType>,
  isProcessing?: boolean,
  onLinkAccount: () => void,
  onCreateNewAccount: () => void,
}

type RequestBodyProps = {
  banners: Array<BannerType>,
  isProcessing?: boolean,
}

const Spinner = () => (
  <Box2 direction="vertical" style={styles.spinnerContainer}>
    <ProgressIndicator type="Large" />
  </Box2>
)

export const SendBody = (props: SendBodyProps) => (
  <Box2 fullWidth={true} fullHeight={true} direction="vertical">
    {props.isProcessing && <Spinner />}
    {props.banners.map(banner => (
      <Banner key={banner.bannerText} background={banner.bannerBackground} text={banner.bannerText} />
    ))}
    <Participants onLinkAccount={props.onLinkAccount} onCreateNewAccount={props.onCreateNewAccount} />
    <AssetInput />
    <Divider />
    <SecretNote />
    <PublicMemo />
    <Footer />
  </Box2>
)

export const RequestBody = (props: RequestBodyProps) => (
  <Box2 fullWidth={true} fullHeight={true} direction="vertical">
    {props.isProcessing && <Spinner />}
    {props.banners.map(banner => (
      <Banner key={banner.bannerText} background={banner.bannerBackground} text={banner.bannerText} />
    ))}
    <Participants />
    <AssetInput />
    <Divider />
    <SecretNote />
    <Footer />
  </Box2>
)

const styles = styleSheetCreate({
  spinnerContainer: {...globalStyles.fillAbsolute},
})
