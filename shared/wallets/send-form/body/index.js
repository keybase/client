// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
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
  <Kb.Box2 direction="vertical" style={styles.spinnerContainer}>
    <Kb.ProgressIndicator type="Large" />
  </Kb.Box2>
)

export const SendBody = (props: SendBodyProps) => (
  <Kb.Box2 fullWidth={true} direction="vertical" style={styles.container}>
    <Kb.ScrollView style={styles.scrollView}>
      {props.isProcessing && <Spinner />}
      {props.banners.map(banner => (
        <Banner key={banner.bannerText} background={banner.bannerBackground} text={banner.bannerText} />
      ))}
      <Participants onLinkAccount={props.onLinkAccount} onCreateNewAccount={props.onCreateNewAccount} />
      <AssetInput />
      <Kb.Divider />
      <SecretNote />
      <PublicMemo />
    </Kb.ScrollView>
    <Footer />
  </Kb.Box2>
)

export const RequestBody = (props: RequestBodyProps) => (
  <Kb.Box2 fullWidth={true} direction="vertical" style={styles.container}>
    <Kb.ScrollView style={styles.scrollView}>
      {props.isProcessing && <Spinner />}
      {props.banners.map(banner => (
        <Banner key={banner.bannerText} background={banner.bannerBackground} text={banner.bannerText} />
      ))}
      <Participants />
      <AssetInput />
      <Kb.Divider />
      <SecretNote />
    </Kb.ScrollView>
    <Footer />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    flexGrow: 1,
    flexShrink: 1,
  },
  scrollView: Styles.platformStyles({
    common: {
      width: '100%',
      flexGrow: 1,
      flexShrink: 1,
    },
    isElectron: {minHeight: '100%'},
  }),
  spinnerContainer: {...Styles.globalStyles.fillAbsolute},
})
