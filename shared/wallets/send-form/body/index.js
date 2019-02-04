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

type SendBodyProps = {|
  banners: Array<BannerType>,
  onReviewPayments: ?() => void,
  isProcessing?: boolean,
|}

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
      <Participants />
      <AssetInput />
      <Kb.Divider />
      <SecretNote />
      <PublicMemo />
    </Kb.ScrollView>
    <Footer />
    {!!props.onReviewPayments && <Failure onReviewPayments={props.onReviewPayments} />}
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

const Failure = ({onReviewPayments}: {onReviewPayments: () => void}) => (
  <Kb.Box2
    direction="vertical"
    centerChildren={true}
    fullWidth={true}
    fullHeight={true}
    gap="small"
    style={styles.failureContainer}
  >
    <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true}>
      <Kb.Text center={true} type="BodyBig">
        PAYMENT FAILED
      </Kb.Text>
      <Kb.Text center={true} type="Body">
        Or, your internet connection failed.
      </Kb.Text>
      <Kb.Text center={true} type="Body">
        Please check your recent payments before trying again.
      </Kb.Text>
    </Kb.Box2>
    <Kb.Button type="Primary" label="Review payments" onClick={onReviewPayments} />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    flexGrow: 1,
    flexShrink: 1,
  },
  failureContainer: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.white_90,
    padding: Styles.globalMargins.tiny,
  },
  scrollView: Styles.platformStyles({
    common: {
      flexGrow: 1,
      flexShrink: 1,
      width: '100%',
    },
    isElectron: {minHeight: '100%'},
  }),
  spinnerContainer: {...Styles.globalStyles.fillAbsolute},
})
