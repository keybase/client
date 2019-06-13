import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isIOS} from '../../constants/platform'
import {countryData, AsYouTypeFormatter, validateNumber} from '../../util/phone-numbers/'
import {memoize} from '../../util/memoize'

const getCallingCode = countryCode => countryData[countryCode].callingCode
const getPlaceholder = countryCode => 'Ex: ' + countryData[countryCode].example
const filterNumeric = text => text.replace(/[^0-9]/g, '')
const defaultCountry = 'US'
const pickerItems = memoize(countryData =>
  Object.values(countryData)
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
    .map((cd: any) => ({label: cd.pickerText, value: cd.alpha2}))
)
const menuItems = memoize((countryData, onClick) =>
  Object.values(countryData)
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
    .map((cd: any) => ({
      onClick: () => onClick(cd.alpha2),
      title: cd.pickerText,
      view: <MenuItem text={cd.pickerText} />,
    }))
)

const MenuItem = props => (
  <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.menuItem}>
    <Kb.Text type="BodySemibold" center={true}>
      {props.text}
    </Kb.Text>
  </Kb.Box2>
)

type Props = {
  defaultCountry?: string
  onChangeNumber: (phoneNumber: string) => void
  onChangeValidity: (valid: boolean) => void
  onEnterKeyDown?: () => void
  style?: Styles.StylesCrossPlatform
}

type State = {
  country: string
  formatted: string
}

class _PhoneInput extends React.Component<Kb.PropsWithOverlay<Props>, State> {
  state = {country: this.props.defaultCountry || defaultCountry, formatted: ''}
  _formatter = new AsYouTypeFormatter(this.props.defaultCountry || defaultCountry)

  _setFormatted = formatted =>
    this.setState(s => {
      if (s.formatted === formatted) {
        return null
      }
      return {formatted}
    }, this._updateParent)

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
      this._setFormatted('')
      return
    }
    for (let i = 0; i < newText.length - 1; i++) {
      this._formatter.inputDigit(newText[i])
    }
    const formatted = this._formatter.inputDigit(newText[newText.length - 1])
    this._setFormatted(formatted)
  }

  _updateParent = () => {
    const validation = validateNumber(this.state.formatted, this.state.country)
    this.props.onChangeNumber(validation.e164)
    this.props.onChangeValidity(validation.valid)
  }

  _setCountry = country => {
    if (this.state.country !== country) {
      this.setState({country})
      this._formatter = new AsYouTypeFormatter(country)
      this._reformat('')
    }
  }

  render() {
    return (
      <>
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
              ref={this.props.setAttachmentRef}
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
            onEnterKeyDown={this.props.onEnterKeyDown}
            value={this.state.formatted}
          />
        </Kb.Box2>
        <CountrySelector
          attachTo={this.props.getAttachmentRef}
          onSelect={this._setCountry}
          onHidden={this.props.toggleShowingMenu}
          selected={this.state.country}
          visible={this.props.showingMenu}
        />
      </>
    )
  }
}
const PhoneInput = Kb.OverlayParentHOC(_PhoneInput)

type CountrySelectorProps = {
  attachTo: () => React.Component<any> | null
  onSelect: (arg0: string) => void
  onHidden: () => void
  selected: string
  visible: boolean
}

type CountrySelectorState = {
  selected: string
}

class CountrySelector extends React.Component<CountrySelectorProps, CountrySelectorState> {
  state = {selected: this.props.selected}

  componentDidUpdate(prevProps: CountrySelectorProps) {
    if (this.props.selected !== prevProps.selected) {
      this._onSelect(this.props.selected)
    }
  }

  _onSelect = selected => this.setState(s => (s.selected === selected ? null : {selected}))

  _onCancel = () => {
    this._onSelect(this.props.selected)
    this.props.onHidden()
  }

  _onDone = () => {
    this.props.onSelect(this.state.selected)
    this.props.onHidden()
  }

  _onSelectMenu = selected => {
    this.props.onSelect(selected)
  }

  render() {
    if (!Styles.isMobile) {
      return (
        <Kb.FloatingMenu
          closeOnSelect={true}
          containerStyle={{maxHeight: 160, width: 240}}
          items={menuItems(countryData, this._onSelectMenu)}
          onHidden={this.props.onHidden}
          visible={this.props.visible}
          attachTo={this.props.attachTo}
        />
      )
    }
    return (
      <Kb.FloatingPicker
        items={pickerItems(countryData)}
        onSelect={this._onSelect}
        onHidden={this._onCancel}
        onCancel={this._onCancel}
        onDone={this._onDone}
        selectedValue={this.state.selected}
        visible={this.props.visible}
      />
    )
  }
}

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
  menuItem: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.medium),
  },
})

export default PhoneInput
