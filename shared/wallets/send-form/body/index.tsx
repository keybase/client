import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import AssetInputBasic from '../asset-input/asset-input-basic-container'
import Banner from '../../banner'
import Footer from '../footer/container'
import * as Constants from '../../../constants/wallets'
import * as Container from '../../../util/container'
import {SecretNote, PublicMemo} from '../note-and-memo/container'
import Participants from '../participants/container'
import {Banner as BannerType} from '../../../constants/types/wallets'
import {sharedStyles} from './shared'

type SendBodyProps = {
  banners: Array<BannerType>
  onReviewPayments: (() => void) | null
  isProcessing?: boolean
}

type RequestBodyProps = {
  banners: Array<BannerType>
  isProcessing?: boolean
}

const Spinner = () => {
  const isBuilding = Container.useAnyWaiting(Constants.buildPaymentWaitingKey)
  return isBuilding ? (
    <Kb.Box2 direction="vertical" style={styles.spinnerContainer}>
      <Kb.ProgressIndicator type="Large" />
    </Kb.Box2>
  ) : null
}

export const SendBody = (props: SendBodyProps) => (
  <Kb.Box2 fullWidth={true} direction="vertical" style={sharedStyles.container}>
    <Kb.ScrollView style={sharedStyles.scrollView}>
      <Spinner />
      {props.banners.map(banner => (
        <Banner
          key={banner.bannerText}
          background={banner.bannerBackground}
          text={banner.bannerText}
          offerAdvancedSendForm={banner.offerAdvancedSendForm}
          onAction={banner.action}
        />
      ))}
      <Participants />
      <AssetInputBasic />
      <Kb.Divider />
      <SecretNote />
      <PublicMemo />
    </Kb.ScrollView>
    <Footer />
    {!!props.onReviewPayments && <Failure onReviewPayments={props.onReviewPayments} />}
  </Kb.Box2>
)

export const RequestBody = (props: RequestBodyProps) => (
  <Kb.Box2 fullWidth={true} direction="vertical" style={sharedStyles.container}>
    <Kb.ScrollView style={sharedStyles.scrollView}>
      {props.isProcessing && <Spinner />}
      {props.banners.map(banner => (
        <Banner key={banner.bannerText} background={banner.bannerBackground} text={banner.bannerText} />
      ))}
      <Participants />
      <AssetInputBasic />
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
    <Kb.Button label="Review payments" onClick={onReviewPayments} />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  failureContainer: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.white_90,
    padding: Styles.globalMargins.tiny,
  },
  spinnerContainer: {
    ...Styles.globalStyles.fillAbsolute,
    paddingLeft: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
})
