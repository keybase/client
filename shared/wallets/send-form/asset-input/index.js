// @flow
import * as React from 'react'
import {Box2, Icon, NewInput, Text} from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {|
  bottomLabel: string,
  displayUnit: string,
  inputPlaceholder: string,
  onChangeAmount: string => void,
  onChangeDisplayUnit: () => void,
  onClickInfo: () => void,
  topLabel: string,
  warningAsset?: string,
  warningPayee?: string,
|}

const AssetInput = (props: Props) => (
  <Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.container}>
    {!!props.topLabel && (
      <Text type="BodySmallSemibold" style={Styles.collapseStyles([styles.topLabel, styles.labelMargin])}>
        {props.topLabel}
      </Text>
    )}
    <NewInput
      type="number"
      decoration={
        <Box2 direction="vertical" style={styles.flexEnd}>
          <Text type="HeaderBigExtrabold" style={styles.unit}>
            {props.displayUnit}
          </Text>
          <Text type="BodySmallPrimaryLink" onClick={props.onChangeDisplayUnit}>
            Change
          </Text>
        </Box2>
      }
      containerStyle={styles.inputContainer}
      style={styles.input}
      onChangeText={props.onChangeAmount}
      textType="HeaderBigExtrabold"
      placeholder={props.inputPlaceholder}
      placeholderColor={Styles.globalColors.purple2_40}
      error={!!props.warningAsset}
    />
    {props.warningAsset &&
      !props.warningPayee && (
        <Text type="BodySmallError">
          Your available to send is{' '}
          <Text type="BodySmallExtrabold" style={{color: Styles.globalColors.red}}>
            {props.warningAsset}
          </Text>
          .
        </Text>
      )}
    {!!props.warningPayee && (
      <Text type="BodySmallError">
        {props.warningPayee} doesn't accept{' '}
        <Text type="BodySmallSemibold" style={{color: Styles.globalColors.red}}>
          {props.warningAsset}
        </Text>
        . Please pick another asset.
      </Text>
    )}
    <Box2 direction="horizontal" fullWidth={true} gap="xtiny">
      <Text type="BodySmall" style={styles.labelMargin} selectable={true}>
        {props.bottomLabel}
      </Text>
      <Icon
        type="iconfont-question-mark"
        color={Styles.globalColors.black_40}
        fontSize={12}
        onClick={props.onClickInfo}
      />
    </Box2>
  </Box2>
)

const styles = Styles.styleSheetCreate({
  unit: {
    color: Styles.globalColors.purple2,
  },
  input: {
    color: Styles.globalColors.purple2,
    position: 'relative',
    top: -8,
  },
  inputContainer: {
    borderWidth: 0,
    paddingLeft: 0,
  },
  flexEnd: {
    alignItems: 'flex-end',
  },
  container: {
    alignItems: 'flex-start',
    paddingRight: Styles.globalMargins.small,
    paddingLeft: Styles.globalMargins.small,
  },
  labelMargin: {marginLeft: 1},
  text: {
    textAlign: 'center',
  },
  topLabel: {color: Styles.globalColors.blue},
})

export default AssetInput
