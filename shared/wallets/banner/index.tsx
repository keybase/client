import * as React from 'react'
import {Box2, Text} from '../../common-adapters'
import {Background} from '../../common-adapters/text'
import * as Styles from '../../styles'
import {AdvancedBanner} from '../../constants/types/rpc-stellar-gen'

export type Props = {
  background: Background
  offerAdvancedSendForm?: AdvancedBanner
  onAction?: (() => void) | null
  reviewProofs?: boolean
  sendFailed?: boolean
  text: string
}

const Banner = (props: Props) => (
  <Box2
    direction="vertical"
    fullWidth={true}
    centerChildren={true}
    style={Styles.collapseStyles([
      styles.container,
      {backgroundColor: Styles.backgroundModeToColor[props.background]},
    ])}
  >
    <Text
      center={true}
      type="BodySmallSemibold"
      negative={true}
      style={{
        color: Styles.backgroundModeToTextColor(props.background),
      }}
    >
      {props.text}
      {props.reviewProofs && props.onAction && (
        <Text
          type="BodySmallSemiboldPrimaryLink"
          center={true}
          style={styles.secondText}
          negative={true}
          onClick={props.onAction}
        >
          Please review.
        </Text>
      )}
      {(props.offerAdvancedSendForm === AdvancedBanner.receiverBanner ||
        props.offerAdvancedSendForm === AdvancedBanner.senderBanner) &&
        props.onAction && (
          <>
            {props.offerAdvancedSendForm === AdvancedBanner.receiverBanner &&
              'This person accepts other assets than XLM. '}
            {props.offerAdvancedSendForm === AdvancedBanner.senderBanner &&
              'You can send more assets than XLM. '}
          </>
        )}
    </Text>
    {(props.offerAdvancedSendForm === AdvancedBanner.receiverBanner ||
      props.offerAdvancedSendForm === AdvancedBanner.senderBanner) &&
      props.onAction && (
        // Place this text outside of the above text so that we can do a paddingBottom on it in order to
        // get the underline to show up
        <Text
          type="BodySmallSemiboldPrimaryLink"
          center={true}
          style={styles.secondText}
          negative={true}
          onClick={props.onAction}
        >
          Send other assets
        </Text>
      )}
    {props.sendFailed && props.onAction && (
      <Text
        type="BodySmallSemiboldPrimaryLink"
        center={true}
        style={styles.secondText}
        negative={true}
        onClick={props.onAction}
      >
        Review payments
      </Text>
    )}
  </Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    minHeight: 40,
    padding: Styles.globalMargins.small,
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  secondText: {paddingBottom: Styles.globalMargins.xtiny, paddingLeft: Styles.globalMargins.xtiny},
})

export default Banner
