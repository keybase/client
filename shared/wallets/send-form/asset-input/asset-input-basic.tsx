import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import Available from '../available/container'
import {AmountInput, sharedStyles} from './shared'

export type Props = {
  bottomLabel: string
  displayUnit: string
  currencyLoading: boolean
  numDecimalsAllowed: number
  onChangeAmount: (amount: string) => void
  onChangeDisplayUnit?: () => void
  topLabel: string
  value: string
  warningAsset?: string
  warningPayee?: string
}

const AssetInputBasic = (props: Props) => (
  <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={sharedStyles.container}>
    {!!props.topLabel && (
      <Kb.Text type="BodySmallSemibold" style={Styles.collapseStyles([styles.topLabel, styles.labelMargin])}>
        {props.topLabel}
      </Kb.Text>
    )}
    <AmountInput
      error={!!props.warningAsset}
      numDecimalsAllowed={props.numDecimalsAllowed}
      onChangeAmount={props.onChangeAmount}
      rightBlock={
        props.currencyLoading ? (
          'loading'
        ) : (
          <Kb.Box2 direction="vertical" style={sharedStyles.currencyContainer}>
            <Kb.Text
              onClick={props.displayUnit && props.onChangeDisplayUnit ? props.onChangeDisplayUnit : null}
              type="HeaderBigExtrabold"
              style={sharedStyles.purple}
            >
              {props.displayUnit}
            </Kb.Text>
            {props.onChangeDisplayUnit && (
              <Kb.Text
                type="BodySmallPrimaryLink"
                onClick={props.displayUnit ? props.onChangeDisplayUnit : null}
              >
                Change
              </Kb.Text>
            )}
          </Kb.Box2>
        )
      }
      value={props.value}
    />
    <Available />
    {!!props.warningPayee && (
      <Kb.Text type="BodySmallError">
        {props.warningPayee} doesn't accept{' '}
        <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.redDark}}>
          {props.warningAsset}
        </Kb.Text>
        . Please pick another asset.
      </Kb.Text>
    )}
    {!!props.bottomLabel && (
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
        <Kb.Text type="BodySmall" style={styles.labelMargin} selectable={true}>
          {props.bottomLabel}
        </Kb.Text>
      </Kb.Box2>
    )}
  </Kb.Box2>
)

export default AssetInputBasic

const styles = Styles.styleSheetCreate({
  labelMargin: {marginLeft: 1},
  topLabel: {color: Styles.globalColors.blueDark},
})
