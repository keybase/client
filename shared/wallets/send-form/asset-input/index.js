// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import Available from '../available/container'

const commasToPeriods = s => s.replace(/,/, '.')

const isValidAmount = (amt, numDecimalsAllowed) => {
  if (!isNaN(Number(amt)) || amt === '.') {
    // This is a valid number. Now check the number of decimal places
    const split = amt.split('.')
    if (split.length === 1) {
      // no decimal places
      return true
    }
    const decimal = split[split.length - 1]
    if (decimal.length <= numDecimalsAllowed) {
      return true
    }
  }
  return false
}

const truncateAmount = (amt, numDecimalsAllowed) => {
  const num = Number(amt)
  return num.toFixed(numDecimalsAllowed)
}

type Props = {|
  bottomLabel: string,
  displayUnit: string,
  inputPlaceholder: string,
  currencyLoading: boolean,
  numDecimalsAllowed: number,
  onChangeAmount: string => void,
  onChangeDisplayUnit: () => void,
  topLabel: string,
  value: string,
  warningAsset?: string,
  warningPayee?: string,
|}

class AssetInput extends React.Component<Props> {
  componentDidMount() {
    if (!isValidAmount(this.props.value, this.props.numDecimalsAllowed)) {
      this.props.onChangeAmount(truncateAmount(this.props.value, this.props.numDecimalsAllowed))
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.numDecimalsAllowed !== prevProps.numDecimalsAllowed &&
      !isValidAmount(this.props.value, this.props.numDecimalsAllowed)
    ) {
      this.props.onChangeAmount(truncateAmount(this.props.value, this.props.numDecimalsAllowed))
    }
  }

  _onChangeAmount = t => {
    // we treat commas and periods as the decimal separator, converted to
    // periods throughout the send form
    const tNormalized = commasToPeriods(t)
    if (isValidAmount(tNormalized, this.props.numDecimalsAllowed)) {
      this.props.onChangeAmount(tNormalized)
    }
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.container}>
        {!!this.props.topLabel && (
          <Kb.Text
            type="BodySmallSemibold"
            style={Styles.collapseStyles([styles.topLabel, styles.labelMargin])}
          >
            {this.props.topLabel}
          </Kb.Text>
        )}
        <Kb.NewInput
          autoFocus={true}
          type="text"
          keyboardType="numeric"
          decoration={
            this.props.currencyLoading ? (
              <Kb.ProgressIndicator style={styles.currencyContainer} />
            ) : (
              <Kb.Box2 direction="vertical" style={styles.currencyContainer}>
                <Kb.Text
                  onClick={this.props.displayUnit ? this.props.onChangeDisplayUnit : null}
                  type="HeaderBigExtrabold"
                  style={styles.unit}
                >
                  {this.props.displayUnit}
                </Kb.Text>
                <Kb.Text
                  type="BodySmallPrimaryLink"
                  onClick={this.props.displayUnit ? this.props.onChangeDisplayUnit : null}
                >
                  Change
                </Kb.Text>
              </Kb.Box2>
            )
          }
          containerStyle={styles.inputContainer}
          style={styles.input}
          onChangeText={this._onChangeAmount}
          textType="HeaderBigExtrabold"
          placeholder={this.props.inputPlaceholder}
          placeholderColor={Styles.globalColors.purple2_40}
          error={!!this.props.warningAsset}
          value={this.props.value}
        />
        <Available />
        {!!this.props.warningPayee && (
          <Kb.Text type="BodySmallError">
            {this.props.warningPayee} doesn't accept{' '}
            <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.red}}>
              {this.props.warningAsset}
            </Kb.Text>
            . Please pick another asset.
          </Kb.Text>
        )}
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
          <Kb.Text type="BodySmall" style={styles.labelMargin} selectable={true}>
            {this.props.bottomLabel}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    alignItems: 'flex-start',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  currencyContainer: Styles.platformStyles({
    common: {
      alignItems: 'flex-end',
    },
    isElectron: {
      height: 44,
    },
    isMobile: {
      height: 52,
    },
  }),
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
  labelMargin: {marginLeft: 1},
  topLabel: {color: Styles.globalColors.blue},
  unit: {
    color: Styles.globalColors.purple2,
  },
})

export default AssetInput
