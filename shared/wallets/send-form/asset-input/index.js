// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import Available from '../available/container'

type Props = {|
  bottomLabel: string,
  defaultCurrencyCode: string,
  displayUnit: string,
  inputPlaceholder: string,
  onChangeAmount: string => void,
  onChangeDisplayUnit: () => void,
  onSetCurrency: () => void,
  topLabel: string,
  value: string,
  warningAsset?: string,
  warningPayee?: string,
  refresh: () => void,
|}

type AssetInputState = {
  hasUserChangedDisplayUnit: boolean,
}

export default class AssetInput extends React.Component<Props, AssetInputState> {
  state = {hasUserChangedDisplayUnit: false}

  _onChangeDisplayUnit = () => {
    this.setState(s => ({hasUserChangedDisplayUnit: true}))
    this.props.onChangeDisplayUnit()
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
            <Kb.Box2 direction="vertical" style={styles.flexEnd}>
              <Kb.Text type="HeaderBigExtrabold" style={styles.unit}>
                {this.props.displayUnit}
              </Kb.Text>
              <Kb.Text type="BodySmallPrimaryLink" onClick={this._onChangeDisplayUnit}>
                Change
              </Kb.Text>
            </Kb.Box2>
          }
          containerStyle={styles.inputContainer}
          style={styles.input}
          onChangeText={t => {
            if (!isNaN(+t) || t === '.') {
              this.props.onChangeAmount(t)
            }
          }}
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

  componentDidMount() {
    this.props.refresh()
    // If the currency code was already in the state, it is unlikely to change
    // so explicitly set the payment currency to default
    if(this.props.defaultCurrencyCode) this.props.onSetCurrency()
  }

  componentDidUpdate() {
    // For changing the building payment based on default currency
    if (! this.state.hasUserChangedDisplayUnit) {
      this.props.onSetCurrency()
    }
  }
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
