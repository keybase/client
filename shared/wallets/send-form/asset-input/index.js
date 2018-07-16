// @flow
import * as React from 'react'
import {Box2, Icon, NewInput, Text} from '../../../common-adapters'
import {collapseStyles, globalColors, styleSheetCreate} from '../../../styles'

type Props = {
  bottomLabel: string,
  displayUnit: string,
  inputPlaceholder: string,
  onChangeAmount: string => void,
  onChangeDisplayUnit: () => void,
  onClickInfo: () => void,
  topLabel: string,
  warningAsset?: string,
  warningPayee?: string,
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
          <Text type="HeaderBigExtrabold" style={styles.colorPurple2}>
            {props.displayUnit}
          </Text>
          <Text type="BodySmallPrimaryLink" onClick={props.onChangeDisplayUnit}>
            Change
          </Text>
        </Box2>
      }
      style={styles.colorPurple2}
      onChangeText={props.onChangeAmount}
      textType="HeaderBigExtrabold"
      placeholder={props.inputPlaceholder}
      placeholderColor={globalColors.purple2_40}
      error={!!props.warningAsset}
    />
    {props.warningAsset &&
      !props.warningPayee && (
        <Text type="BodySmallError">
          Your available to send is{' '}
          <Text type="BodySmallSemibold" style={{color: globalColors.red}}>
            {props.warningAsset}
          </Text>
        </Text>
      )}
    {props.warningPayee && (
      <Text type="BodySmallError">
        {props.warningPayee} doesn't accept{' '}
        <Text type="BodySmallSemibold" style={{color: globalColors.red}}>
          {props.warningAsset}
        </Text>
        . Please pick another asset.
      </Text>
    )}
    <Box2 direction="horizontal" fullWidth={true} gap="xtiny">
      <Text type="BodySmall" style={styles.labelMargin}>
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
  colorPurple2: {color: globalColors.purple2},
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
