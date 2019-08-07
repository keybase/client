import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isIOS, isMobile} from '../../constants/platform'
import {
  countryData,
  CountryData,
  codeToCountry,
  areaCodeIsCanadian,
  AsYouTypeFormatter,
  validateNumber,
} from '../../util/phone-numbers'
import {memoize} from '../../util/memoize'

const normalizeCountryCode = countryCode =>
  countryCode.endsWith('?') ? countryCode.slice(0, -1) : countryCode
const getCallingCode = countryCode =>
  countryCode !== '' ? countryData[normalizeCountryCode(countryCode)].callingCode : ''
const getCountryEmoji = countryCode => (
  <Kb.Emoji size={16} emojiName={countryData[normalizeCountryCode(countryCode)].emojiText} />
)
const getPlaceholder = countryCode =>
  countryCode !== '' ? 'Ex: ' + countryData[normalizeCountryCode(countryCode)].example : 'N/A'
const filterNumeric = text => text.replace(/[^\d]/g, '')
const defaultCountry = 'US'
const prioritizedCountries = ['US', 'CA', 'GB']

const pickerItems = memoize(countryData =>
  [
    ...prioritizedCountries.map(code => countryData[code]),
    ...Object.values<CountryData>(countryData)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(cd => {
        if (prioritizedCountries.includes(cd.alpha2)) {
          return {
            ...cd,
            alpha2: cd.alpha2 + '?',
          }
        }
        return cd
      }),
  ].map(cd => ({label: cd.pickerText, value: cd.alpha2}))
)
const menuItems = memoize((countryData, filter, onClick) => {
  const strippedFilter = filterNumeric(filter)
  const lowercaseFilter = filter.toLowerCase()

  return Object.values<CountryData>(countryData)
    .filter(cd => {
      if (strippedFilter.length > 0) {
        return filterNumeric(cd.callingCode).startsWith(strippedFilter)
      }
      return cd.pickerText.toLowerCase().includes(filter.toLowerCase())
    })
    .sort((a: CountryData, b: CountryData) => {
      // Special cases
      for (const country of prioritizedCountries) {
        const countryName = countryData[country].name
        if (a.name === countryName) {
          return -1
        }
        if (b.name === countryName) {
          return 1
        }
      }

      // Numeric prefix matcher
      if (strippedFilter.length > 0) {
        const aCallingCode = filterNumeric(a.callingCode)
        const bCallingCode = filterNumeric(b.callingCode)

        // Exact match, fixes +47 (Norway and Svalbard) vs Bermuda's +471
        if (aCallingCode === strippedFilter && bCallingCode !== strippedFilter) {
          return -1
        }
        if (aCallingCode !== strippedFilter && bCallingCode === strippedFilter) {
          return 1
        }
        if (aCallingCode === strippedFilter && bCallingCode === strippedFilter) {
          return a.name.localeCompare(b.name)
        }

        const aCodeMatch = aCallingCode.startsWith(strippedFilter)
        const bCodeMatch = bCallingCode.startsWith(strippedFilter)

        // Either matches
        if (aCodeMatch && !bCodeMatch) {
          return -1
        }
        if (!aCodeMatch && bCodeMatch) {
          return 1
        }
        // Both or none match perfectly, sort alphabetically
        return a.name.localeCompare(b.name)
      }

      // Textual prefix matcher
      const aPrefixMatch = a.name.toLowerCase().startsWith(lowercaseFilter)
      const bPrefixMatch = b.name.toLowerCase().startsWith(lowercaseFilter)
      if (aPrefixMatch && !bPrefixMatch) {
        return -1
      }
      if (!aPrefixMatch && bPrefixMatch) {
        return 1
      }

      // Fallback to alphabetical sorting
      return a.name.localeCompare(b.name)
    })
    .map((cd: CountryData) => ({
      onClick: () => onClick(cd.alpha2),
      title: cd.pickerText,
      view: <MenuItem emoji={cd.emojiText} text={cd.pickerText} />,
    }))
})

const MenuItem = props => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItem} gap="xtiny" alignItems="center">
    <Kb.Text type="Body" center={true}>
      <Kb.Emoji size={18} emojiName={props.emoji} />
    </Kb.Text>
    <Kb.Text type="BodySemibold">{props.text}</Kb.Text>
  </Kb.Box2>
)

type CountrySelectorProps = {
  attachTo?: () => React.Component<any> | null
  onSelect: (arg0: string) => void
  onHidden: () => void
  selected: string
  visible: boolean
}

type CountrySelectorState = {
  selected: string
  filter: string
}

class CountrySelector extends React.Component<CountrySelectorProps, CountrySelectorState> {
  state = {
    filter: '',
    selected: this.props.selected,
  }

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

  onSelectMenu = selected => {
    this.props.onSelect(selected)
  }

  _onChangeFilter = filter => this.setState(() => ({filter}))

  clearFilter() {
    this._onChangeFilter('')
  }

  render() {
    if (!Styles.isMobile) {
      return (
        <Kb.FloatingMenu
          closeOnSelect={true}
          containerStyle={styles.countryLayout}
          header={{
            title: 'Search',
            view: (
              <Kb.Box2 style={styles.searchWrapper} direction="horizontal" fullWidth={true}>
                <Kb.SearchFilter
                  icon="iconfont-search"
                  fullWidth={true}
                  onChange={this._onChangeFilter}
                  placeholderText="Search"
                  focusOnMount={true}
                />
              </Kb.Box2>
            ),
          }}
          items={menuItems(countryData, this.state.filter, this.onSelectMenu)}
          listStyle={styles.countryList}
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

type Props = {
  autoFocus?: boolean
  defaultCountry?: string
  onChangeNumber: (phoneNumber: string) => void
  onChangeValidity: (valid: boolean) => void
  onEnterKeyDown?: () => void
  style?: Styles.StylesCrossPlatform
}

type State = {
  country: string
  prefix: string
  formatted: string
}

class _PhoneInput extends React.Component<Kb.PropsWithOverlay<Props>, State> {
  state = {
    country: this.props.defaultCountry || defaultCountry,
    formatted: '',
    prefix: getCallingCode(this.props.defaultCountry || defaultCountry).slice(1),
  }
  _formatter = new AsYouTypeFormatter(this.props.defaultCountry || defaultCountry)
  _countrySelectorRef = React.createRef<CountrySelector>()
  _phoneInputRef = React.createRef<Kb.PlainInput>()

  _setFormattedPhoneNumber = formatted =>
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
  _reformatPhoneNumber = (_newText, skipCountry) => {
    this._formatter.clear()
    const newText = filterNumeric(_newText)
    if (newText.trim().length === 0) {
      this._setFormattedPhoneNumber('')
      return
    }
    for (let i = 0; i < newText.length - 1; i++) {
      this._formatter.inputDigit(newText[i])
    }
    const formatted = this._formatter.inputDigit(newText[newText.length - 1])
    this._setFormattedPhoneNumber(formatted)

    // Special case for NA area
    if (this.state.prefix === '1' && !skipCountry) {
      // Only numeric, trimmed from whitespace
      const trimmedText = newText.trim()
      // If the area code is present...
      if (trimmedText.length >= 3) {
        // Prepare the potential 4 number prefix
        const areaCode = trimmedText.slice(0, 3)
        const extPrefix = this.state.prefix + ' ' + areaCode

        // First look it up against the table
        const possibleMatch = codeToCountry[extPrefix]
        if (possibleMatch) {
          this._setCountry(possibleMatch, false)
        } else {
          // Otherwise determine the country using the hardcoded ranges
          if (areaCodeIsCanadian(areaCode)) {
            this._setCountry('CA', true)
          } else {
            this._setCountry('US', true)
          }
        }
      }
    }
  }

  _reformatPrefix = (_newText, skipCountry) => {
    let newText = filterNumeric(_newText)
    if (!skipCountry) {
      const matchedCountry = codeToCountry[newText]
      if (matchedCountry) {
        this._setCountry(matchedCountry, false)
      } else {
        // Invalid country
        this._setCountry('', false)
      }
    }

    // NA countries that use area codes require special behaviour
    if (newText.length === 4) {
      newText = newText[0]
    }
    this.setState({
      prefix: newText,
    })
  }

  _updateParent = () => {
    const validation = validateNumber(this.state.formatted, this.state.country)
    this.props.onChangeNumber(validation.e164)
    this.props.onChangeValidity(validation.valid)
  }

  _setCountry = (country, keepPrefix) => {
    if (this.state.country !== country) {
      country = normalizeCountryCode(country)

      this.setState({country})
      if (country !== '') {
        this._formatter = new AsYouTypeFormatter(country)
      }

      // Special behaviour for NA numbers
      if (getCallingCode(country).length === 6) {
        this._reformatPhoneNumber(getCallingCode(country).slice(-3), true)
      } else if (!keepPrefix) {
        this._reformatPhoneNumber('', true)
      }
      this._reformatPrefix(getCallingCode(country).slice(1), true)
    }
  }

  _toggleShowingMenu = () => {
    if (this.state.country === '') {
      this._countrySelectorRef.current &&
        this._countrySelectorRef.current.onSelectMenu(this.props.defaultCountry || defaultCountry)
    }
    this._countrySelectorRef.current && this._countrySelectorRef.current.clearFilter()
    this.props.toggleShowingMenu()
  }

  _onPrefixEnter = () => {
    this._phoneInputRef.current && this._phoneInputRef.current.focus()
  }

  _renderCountrySelector = () => {
    if (Styles.isMobile) {
      return (
        <Kb.Text type="BodySemibold" style={styles.countrySelector}>
          {this.state.country === ''
            ? this.state.prefix === ''
              ? '- Pick a country -'
              : '- Invalid country prefix -'
            : countryData[this.state.country].emoji + ' ' + countryData[this.state.country].name}
        </Kb.Text>
      )
    }

    return (
      <>
        <Kb.Text type="Body" style={styles.countrySelector}>
          {getCountryEmoji(this.state.country)}
        </Kb.Text>
        <Kb.Text type="BodySemibold" style={styles.countrySelector}>
          {'+' + this.state.prefix}
        </Kb.Text>
      </>
    )
  }

  render() {
    return (
      <Kb.Box2 direction={isMobile ? 'vertical' : 'horizontal'} style={styles.container}>
        <Kb.Box2
          alignItems="center"
          direction="horizontal"
          style={Styles.collapseStyles([styles.countrySelectorRow, styles.fakeInput])}
        >
          <Kb.ClickableBox onClick={this._toggleShowingMenu} style={styles.fullWidth}>
            <Kb.Box2
              direction="horizontal"
              style={styles.countrySelectorContainer}
              alignItems="center"
              gap="xtiny"
              ref={this.props.setAttachmentRef}
            >
              {this._renderCountrySelector()}
              <Kb.Icon type="iconfont-caret-down" sizeType="Tiny" />
            </Kb.Box2>
          </Kb.ClickableBox>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap={isMobile ? 'tiny' : undefined} style={styles.fullWidth}>
          {isMobile && (
            <Kb.Box2
              alignItems="center"
              direction="horizontal"
              style={Styles.collapseStyles([styles.prefixContainer, styles.fakeInput])}
            >
              <Kb.Text type="BodySemibold" style={styles.prefixPlus}>
                {'+'}
              </Kb.Text>
              <Kb.PlainInput
                style={Styles.collapseStyles([styles.plainInput, styles.prefixInput])}
                flexable={true}
                keyboardType={isIOS ? 'number-pad' : 'numeric'}
                onChangeText={x => this._reformatPrefix(x, false)}
                maxLength={3}
                onEnterKeyDown={this._onPrefixEnter}
                returnKeyType="next"
                value={this.state.prefix}
              />
            </Kb.Box2>
          )}
          <Kb.Box2
            alignItems="center"
            direction="horizontal"
            style={Styles.collapseStyles([styles.phoneNumberContainer, styles.fakeInput])}
          >
            <Kb.PlainInput
              autoFocus={this.props.autoFocus}
              style={Styles.collapseStyles([styles.plainInput])}
              flexable={true}
              keyboardType={isIOS ? 'number-pad' : 'numeric'}
              placeholder={getPlaceholder(this.state.country)}
              onChangeText={x => this._reformatPhoneNumber(x, false)}
              onEnterKeyDown={this.props.onEnterKeyDown}
              value={this.state.formatted}
              disabled={this.state.country === ''}
              ref={this._phoneInputRef}
              maxLength={17}
              textContentType="telephoneNumber"
            />
          </Kb.Box2>
        </Kb.Box2>
        <CountrySelector
          attachTo={this.props.getAttachmentRef}
          onSelect={x => this._setCountry(x, false)}
          onHidden={this._toggleShowingMenu}
          selected={this.state.country}
          visible={this.props.showingMenu}
          ref={this._countrySelectorRef}
        />
      </Kb.Box2>
    )
  }
}
const PhoneInput = Kb.OverlayParentHOC(_PhoneInput)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      borderColor: Styles.globalColors.black_10,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
      height: 38,
      width: 368,
    },
  }),
  countryLayout: {
    maxHeight: 200,
    overflow: 'hidden',
    width: 240,
  },
  countryList: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxColumn,
      display: 'block',
      maxHeight: 160,
      overflowX: 'hidden',
      overflowY: 'auto',
      paddingBottom: 0,
      paddingTop: 0,
    },
  }),
  countrySelector: Styles.platformStyles({
    common: {
      marginRight: Styles.globalMargins.xtiny,
    },
    isMobile: {
      flexGrow: 1,
    },
  }),
  countrySelectorContainer: Styles.platformStyles({
    common: {
      ...Styles.padding(0, Styles.globalMargins.xsmall),
    },
    isElectron: {
      borderRightColor: Styles.globalColors.black_10,
      borderRightWidth: '1px',
      borderStyle: 'solid',
      height: 36,
    },
  }),
  countrySelectorRow: Styles.platformStyles({
    isMobile: {
      marginBottom: Styles.globalMargins.tiny,
    },
  }),
  fakeInput: Styles.platformStyles({
    isMobile: {
      backgroundColor: Styles.globalColors.white,
      borderColor: Styles.globalColors.black_10,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
      height: 48,
    },
  }),
  fullWidth: {width: '100%'},
  menuItem: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xtiny),
  },
  phoneNumberContainer: {
    flexGrow: 1,
  },
  plainInput: Styles.platformStyles({
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xsmall),
      height: 36,
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small),
      height: 48,
    },
  }),
  prefixContainer: {
    flexGrow: 0,
  },
  prefixInput: {
    textAlign: 'right',
  },
  prefixPlus: {
    paddingLeft: Styles.globalMargins.tiny,
  },
  searchWrapper: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny),
  },
})

export default PhoneInput
