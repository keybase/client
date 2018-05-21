// @flow
import * as React from 'react'
import {Box2, Icon, NewInput, Text} from '../../../common-adapters'
import {collapseStyles, globalColors, styleSheetCreate} from '../../../styles'

type Props = {
  bottomLabel: string,
  displayUnit: string,
  inputPlaceholder: string,
  onChangeDisplayUnit: () => void,
  onClickInfo: () => void,
  topLabel: string,
}

const AssetInput = (props: Props) => (
  <Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.flexStart}>
    {!!props.topLabel && (
      <Text type="BodySmallSemibold" style={collapseStyles([styles.topLabel, styles.labelMargin])}>
        {props.topLabel}
      </Text>
    )}
    <NewInput
      type="number"
      decoration={
        <Box2 direction="vertical" style={styles.flexEnd}>
          <Text type="HeaderBigExtrabold">{props.displayUnit}</Text>
          <Text type="BodySmallPrimaryLink" onClick={props.onChangeDisplayUnit}>
            Change
          </Text>
        </Box2>
      }
      textType="HeaderBigExtrabold"
      placeholder={props.inputPlaceholder}
    />
    <Box2 direction="horizontal" fullWidth={true} gap="xtiny">
      <Text type="BodySmall" style={styles.label}>
        {props.bottomLabel}
      </Text>
      <Icon
        type="iconfont-question-mark"
        color={globalColors.black_40}
        fontSize={12}
        onClick={props.onClickInfo}
      />
    </Box2>
  </Box2>
)

const styles = styleSheetCreate({
  flexEnd: {
    alignItems: 'flex-end',
  },
  flexStart: {
    alignItems: 'flex-start',
  },
  labelMargin: {marginLeft: 1},
  text: {
    textAlign: 'center',
  },
  topLabel: {color: globalColors.blue},
})

export default AssetInput
