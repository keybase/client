// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import Available from '../available/container'

type Props = {|
  bottomLabel: string,
  displayUnit: string,
  inputPlaceholder: string,
  numDecimalsAllowed: number,
  onChangeAmount: string => void,
  onChangeDisplayUnit: () => void,
  topLabel: string,
  value: string,
  warningAsset?: string,
  warningPayee?: string,
|}

const AssetInput = (props: Props) => {
  const onChangeAmount = t => {
    if (!isNaN(+t) || t === '.') {
      // This is a valid number. Now check the number of decimal places
      const split = t.includes('.') && t.split('.')
      if (!split) {
        // no decimal places
        props.onChangeAmount(t)
        return
      }
      const decimal = split[split.length - 1]
      if (decimal.length <= props.numDecimalsAllowed) {
        props.onChangeAmount(t)
      }
    }
  }
  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.container}>
      {!!props.topLabel && (
        <Kb.Text
          type="BodySmallSemibold"
          style={Styles.collapseStyles([styles.topLabel, styles.labelMargin])}
        >
          {props.topLabel}
        </Kb.Text>
      )}
      <Kb.NewInput
        autoFocus={true}
        type="text"
        keyboardType="numeric"
        decoration={
          <Kb.Box2 direction="vertical" style={styles.flexEnd}>
            <Kb.Text type="HeaderBigExtrabold" style={styles.unit}>
              {props.displayUnit}
            </Kb.Text>
            <Kb.Text type="BodySmallPrimaryLink" onClick={props.onChangeDisplayUnit}>
              Change
            </Kb.Text>
          </Kb.Box2>
        }
        containerStyle={styles.inputContainer}
        style={styles.input}
        onChangeText={onChangeAmount}
        textType="HeaderBigExtrabold"
        placeholder={props.inputPlaceholder}
        placeholderColor={Styles.globalColors.purple2_40}
        error={!!props.warningAsset}
        value={props.value}
      />
      <Available />
      {!!props.warningPayee && (
        <Kb.Text type="BodySmallError">
          {props.warningPayee} doesn't accept{' '}
          <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.red}}>
            {props.warningAsset}
          </Kb.Text>
          . Please pick another asset.
        </Kb.Text>
      )}
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
        <Kb.Text type="BodySmall" style={styles.labelMargin} selectable={true}>
          {props.bottomLabel}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

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
    paddingTop: 0,
  },
  flexEnd: {
    alignItems: 'flex-end',
  },
  container: {
    alignItems: 'flex-start',
    paddingRight: Styles.globalMargins.small,
    paddingLeft: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
    paddingBottom: Styles.globalMargins.tiny,
  },
  labelMargin: {marginLeft: 1},
  text: {
    textAlign: 'center',
  },
  topLabel: {color: Styles.globalColors.blue},
})

export default AssetInput
