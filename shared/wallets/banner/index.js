// @flow
import * as React from 'react'
import {Box2, Text} from '../../common-adapters'
import type {Background} from '../../common-adapters/text'
import {backgroundModeToColor, collapseStyles, globalMargins, styleSheetCreate} from '../../styles'

type Props = {
  background: Background,
  onAction?: ?() => void,
  reviewProofs?: boolean,
  sendFailed?: boolean,
  text: string,
}

const Banner = (props: Props) => (
  <Box2
    direction="vertical"
    fullWidth={true}
    centerChildren={true}
    style={collapseStyles([styles.container, {backgroundColor: backgroundModeToColor[props.background]}])}
  >
    <Text center={true} type="BodySmallSemibold" backgroundMode={props.background}>
      {props.text}
      {props.reviewProofs && (
        <Text
          type="BodySmallSemiboldPrimaryLink"
          center={true}
          style={styles.secondText}
          backgroundMode={props.background}
          onClick={props.onAction}
        >
          Please review.
        </Text>
      )}
    </Text>
    {props.sendFailed && (
      <Text
        type="BodySmallSemiboldPrimaryLink"
        center={true}
        style={styles.secondText}
        backgroundMode={props.background}
        onClick={props.onAction}
      >
        Review payments
      </Text>
    )}
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    minHeight: 40,
    padding: globalMargins.small,
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
  },
  secondText: {paddingLeft: globalMargins.xtiny},
})

export default Banner
