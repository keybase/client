// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isIOS} from '../../constants/platform'
import {countryData, AsYouTypeFormatter} from '../../util/phone-numbers/'

const getCallingCode = countryCode => countryData[countryCode].callingCode
const getPlaceholder = countryCode => 'Ex: ' + countryData[countryCode].example
const filterNumeric = text => text.replace(/[^0-9]/g, '')
const defaultCountry = 'US'

type Props = {
  defaultCountry?: string, // TODO get this from core. ISO 3166-1 alpha-2 format (e.g. 'US')
  error: string,
  onChangeNumber: (number: string) => void, // E.164 format (e.g. '+18002667883').
  style?: Styles.StylesCrossPlatform,
}

type State = {
  country: string,
  formatted: string,
}

class _PhoneInput extends React.Component<Kb.PropsWithOverlay<Props>, State> {
  state = {country: this.props.defaultCountry || defaultCountry, formatted: ''}
  _formatter = new AsYouTypeFormatter(this.props.defaultCountry || defaultCountry)

  // AsYouTypeFormatter doesn't support backspace
  // To get around this, on every text change:
  // 1. Clear the formatter
  // 2. Remove any non-numerics from the text
  // 3. Feed the new text into the formatter char by char
  // 4. Set the value of the input to the new formatted
  _reformat = _newText => {
    this._formatter.clear()
    const newText = filterNumeric(_newText)
    if (newText.trim().length === 0) {
      this.setState({formatted: ''})
      this._updateParent()
      return
    }
    for (let i = 0; i < newText.length - 1; i++) {
      this._formatter.inputDigit(newText[i])
    }
    const formatted = this._formatter.inputDigit(newText[newText.length - 1])
    this.setState({formatted})
    this._updateParent()
  }

  _updateParent = () => {}

  render() {
    return (
      <Kb.Box2
        alignItems="center"
        direction="horizontal"
        style={Styles.collapseStyles([styles.container, this.props.style])}
      >
        <Kb.ClickableBox onClick={this.props.toggleShowingMenu} style={styles.fullHeight}>
          <Kb.Box2
            direction="horizontal"
            style={styles.callingCodeContainer}
            alignItems="center"
            fullHeight={true}
            gap="small"
          >
            <Kb.Text type="BodySemibold">{getCallingCode(this.state.country)}</Kb.Text>
            <Kb.Icon type="iconfont-caret-down" sizeType="Small" />
          </Kb.Box2>
        </Kb.ClickableBox>
        <Kb.PlainInput
          autoFocus={true}
          style={styles.input}
          flexable={true}
          keyboardType={isIOS ? 'number-pad' : 'numeric'}
          placeholder={getPlaceholder(this.state.country)}
          onChangeText={this._reformat}
          value={this.state.formatted}
        />
      </Kb.Box2>
    )
  }
}
const PhoneInput = Kb.OverlayParentHOC(_PhoneInput)

const styles = Styles.styleSheetCreate({
  callingCodeContainer: {
    ...Styles.padding(0, Styles.globalMargins.xsmall),
    borderRightColor: Styles.globalColors.black_10,
    borderRightWidth: 1,
    borderStyle: 'solid',
  },
  container: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
  },
  fullHeight: {height: '100%'},
  input: Styles.platformStyles({
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xsmall),
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small),
    },
  }),
})

export default PhoneInput
