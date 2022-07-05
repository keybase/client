import * as React from 'react'
import * as Styles from '../styles'
import Emoji from './emoji'
import Text from './text'
import {Box2} from './box'
import FloatingMenu from './floating-menu'
import SearchFilter from './search-filter'
import PlainInput from './plain-input'
import FloatingPicker from './floating-picker'
import OverlayParentHOC, {PropsWithOverlay} from './overlay/parent-hoc'
import ProgressIndicator from './progress-indicator'
import ClickableBox from './clickable-box'
import Icon from './icon'
import {isIOS, isMobile} from '../constants/platform'
import {
  countryData,
  CountryData,
  codeToCountry,
  areaCodeIsCanadian,
  AsYouTypeFormatter,
  validateNumber,
} from '../util/phone-numbers'
import {memoize} from '../util/memoize'

const Kb = {
  Box2,
  ClickableBox,
  Emoji,
  FloatingMenu,
  FloatingPicker,
  Icon,
  OverlayParentHOC,
  PlainInput,
  ProgressIndicator,
  SearchFilter,
  Text,
}

const normalizeCountryCode = (countryCode: string) =>
  countryCode.endsWith('?') ? countryCode.slice(0, -1) : countryCode
const getCallingCode = (countryCode: string) =>
  countryCode !== '' ? countryData()[normalizeCountryCode(countryCode)].callingCode : ''
const getCountryEmoji = (countryCode: string) => (
  <Kb.Emoji size={16} emojiName={countryData()[normalizeCountryCode(countryCode)].emojiText} />
)
const getPlaceholder = (countryCode: string) =>
  countryCode !== '' ? 'Ex: ' + countryData()[normalizeCountryCode(countryCode)].example : 'N/A'
const filterNumeric = (text: string) => text.replace(/[^\d]/g, '')
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
      alpha2: cd.alpha2,
      onClick: () => onClick(cd.alpha2),
      title: cd.pickerText,
      view: <MenuItem emoji={cd.emojiText} text={cd.pickerText} />,
    }))
})

const MenuItem = (props: {emoji: string; text: string}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItem} gap="xtiny" alignItems="center">
    <Kb.Text type="Body" center={true}>
      <Kb.Emoji size={18} emojiName={props.emoji} />
    </Kb.Text>
    <Kb.Text type="BodySemibold">{props.text}</Kb.Text>
  </Kb.Box2>
)

type CountrySelectorProps = {
  attachTo?: () => React.Component<any> | null
  onSelect: (s?: string) => void
  onHidden: () => void
  selected?: string
  visible: boolean
}

type CountrySelectorState = {
  selected?: string
  filter: string
}

class CountrySelector extends React.Component<CountrySelectorProps, CountrySelectorState> {
  state = {
    filter: '',
    selected: this.props.selected,
  }
  private desktopItems:
    | Array<{alpha2: string; onClick: () => void; title: string; view: React.ReactNode}>
    | undefined
  private mobileItems: Array<{label: string; value: string}> | undefined

  componentDidUpdate(prevProps: CountrySelectorProps) {
    if (this.props.selected !== prevProps.selected) {
      this.onSelect(this.props.selected)
    }
  }

  private onSelect = (selected?: string) => this.setState(s => (s.selected === selected ? null : {selected}))

  private onSelectFirst = () => {
    if (Styles.isMobile && this.mobileItems && this.mobileItems[0]) {
      this.onSelectMenu(this.mobileItems[0].value)
    } else if (this.desktopItems && this.desktopItems[0]) {
      this.onSelectMenu(this.desktopItems[0].alpha2)
    }
    this.props.onHidden()
  }

  private onCancel = () => {
    this.onSelect(this.props.selected)
    this.props.onHidden()
  }

  private onDone = () => {
    if (!this.state.selected) {
      return
    }
    this.props.onSelect(this.state.selected)
    this.props.onHidden()
  }

  onSelectMenu = (selected: string) => {
    this.props.onSelect(selected)
  }

  private onChangeFilter = (filter: string) => this.setState(() => ({filter}))

  clearFilter() {
    this.onChangeFilter('')
  }

  render() {
    if (!isMobile) {
      this.desktopItems = menuItems(countryData(), this.state.filter, this.onSelectMenu)
      return (
        <Kb.FloatingMenu
          closeOnSelect={true}
          containerStyle={styles.countryLayout}
          header={
            <Kb.Box2 style={styles.searchWrapper} direction="horizontal" fullWidth={true}>
              <Kb.SearchFilter
                size="full-width"
                icon="iconfont-search"
                placeholderCentered={true}
                mobileCancelButton={true}
                onChange={this.onChangeFilter}
                placeholderText="Search"
                focusOnMount={true}
                onEnterKeyDown={this.onSelectFirst}
              />
            </Kb.Box2>
          }
          items={this.desktopItems}
          listStyle={styles.countryList}
          onHidden={this.props.onHidden}
          visible={this.props.visible}
          attachTo={this.props.attachTo}
        />
      )
    }
    this.mobileItems = pickerItems(countryData())
    return (
      <Kb.FloatingPicker
        items={this.mobileItems}
        onSelect={this.onSelect}
        onHidden={this.onCancel}
        onCancel={this.onCancel}
        onDone={this.onDone}
        selectedValue={this.state.selected}
        visible={this.props.visible}
      />
    )
  }
}

type Props = {
  autoFocus?: boolean
  defaultCountry?: string
  onChangeNumber: (phoneNumber: string, valid: boolean) => void
  onEnterKeyDown?: React.ComponentProps<typeof PlainInput>['onEnterKeyDown']
  onClear?: () => void
  small?: boolean // default is true on desktop and false on mobile
  style?: Styles.StylesCrossPlatform
}

type State = {
  country?: string
  prefix?: string
  formatted: string
  formatter?: libphonenumber.AsYouTypeFormatter
  focused: boolean
}

class _PhoneInput extends React.Component<PropsWithOverlay<Props>, State> {
  state = {
    country: this.props.defaultCountry,
    focused: false,
    formatted: '',
    formatter: this.props.defaultCountry ? new AsYouTypeFormatter(this.props.defaultCountry) : undefined,
    prefix: this.props.defaultCountry && getCallingCode(this.props.defaultCountry).slice(1),
  }
  private countrySelectorRef = React.createRef<CountrySelector>()
  private phoneInputRef = React.createRef<PlainInput>()

  private setFormattedPhoneNumber = (formatted: string) =>
    this.setState(s => {
      if (s.formatted === formatted) {
        return null
      }
      return {formatted}
    }, this.updateParent)

  // AsYouTypeFormatter doesn't support backspace
  // To get around this, on every text change:
  // 1. Clear the formatter
  // 2. Remove any non-numerics from the text
  // 3. Feed the new text into the formatter char by char
  // 4. Set the value of the input to the new formatted
  private reformatPhoneNumber = (_newText: string, skipCountry: boolean) => {
    if (!this.state.formatter) {
      return
    }

    let newText = _newText

    // ACME DIGIT REMOVAL MACHINE 5000
    // This code works around iOS not letting you accurately move your cursor
    // anymore. Fixes editing "middle" numbers in the phone number input.
    // 1) It doesn't run in reformats with skipCountry:true
    // 2) It only runs when the total length decreased
    // 3) It only runs when we had formatted text before
    // 4) It should not do anything if it wasn't a whitespace change in the middle
    if (!skipCountry && newText.length < this.state.formatted.length && this.state.formatted.length !== 0) {
      // Look at the new text and figure out which character is different
      let diffIndex: number = -1
      for (let i = 0; i < newText.length; i++) {
        if (i + 1 > this.state.formatted.length || newText[i] !== this.state.formatted[i]) {
          diffIndex = i
          break
        }
      }

      // Make sure that the change was in the middle of the text
      if (diffIndex !== -1 && diffIndex + 1 <= this.state.formatted.length) {
        // Look at the original character at that location
        const changedChar = this.state.formatted[diffIndex]

        // Make sure that the changed char isn't a number
        if (isNaN(parseInt(changedChar, 10))) {
          // At this point we're certain we're in the special scenario.

          // Take everything BUT the different character, make it all numbers
          const beforeDiff = filterNumeric(newText.substr(0, diffIndex))
          // We don't care about what's in the section that includes the difference
          const afterDiff = newText.substr(diffIndex)

          // Combine it back into a newText, slicing off the last character of beforeDiff
          newText = beforeDiff.slice(0, -1).concat(afterDiff)
        }
      }
    }

    this.state.formatter.clear()
    newText = filterNumeric(newText)

    if (newText.trim().length === 0) {
      this.setFormattedPhoneNumber('')
      return
    }
    for (let i = 0; i < newText.length - 1; i++) {
      this.state.formatter.inputDigit(newText[i])
    }
    const formatted = this.state.formatter.inputDigit(newText[newText.length - 1])
    this.setFormattedPhoneNumber(formatted)

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
        const possibleMatch = codeToCountry()[extPrefix]
        if (possibleMatch) {
          this.setCountry(possibleMatch, false)
        } else {
          // Otherwise determine the country using the hardcoded ranges
          if (areaCodeIsCanadian(areaCode)) {
            this.setCountry('CA', true)
          } else {
            this.setCountry('US', true)
          }
        }
      }
    }
  }

  private reformatPrefix = (_newText: string, skipCountry: boolean) => {
    let newText = filterNumeric(_newText)
    if (!skipCountry) {
      const matchedCountry = codeToCountry()[newText]
      if (matchedCountry) {
        this.setCountry(matchedCountry, false)
      } else {
        // Invalid country
        this.setCountry('', false)
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

  private updateParent = () => {
    const validation = validateNumber(this.state.formatted, this.state.country)
    this.props.onChangeNumber(validation.e164, validation.valid)
  }

  private setCountry = (country: string, keepPrefix: boolean) => {
    if (this.state.country !== country) {
      country = normalizeCountryCode(country)

      this.setState({
        country,
        formatter: country ? new AsYouTypeFormatter(country) : undefined,
      })

      // Special behaviour for NA numbers
      if (getCallingCode(country).length === 6) {
        this.reformatPhoneNumber(getCallingCode(country).slice(-3), true)
      } else if (!keepPrefix) {
        this.reformatPhoneNumber('', true)
      }
      this.reformatPrefix(getCallingCode(country).slice(1), true)
    }
  }

  private toggleShowingMenu = () => {
    if (!this.state.country && this.props.defaultCountry) {
      this.countrySelectorRef.current &&
        this.countrySelectorRef.current.onSelectMenu(this.props.defaultCountry)
    }
    this.countrySelectorRef.current && this.countrySelectorRef.current.clearFilter()
    this.props.toggleShowingMenu()
  }

  private onPrefixEnter = () => {
    this.phoneInputRef.current && this.phoneInputRef.current.focus()
  }

  private isSmall = () => {
    return this.props.small ?? !Styles.isMobile
  }

  private renderCountrySelector = () => {
    if (this.state.country === undefined) {
      return null
    }

    if (!this.isSmall()) {
      return (
        <Kb.Text
          type="BodySemibold"
          style={Styles.collapseStyles([styles.countrySelector, styles.countrySelectorBig])}
        >
          {!this.state.country
            ? !this.state.prefix
              ? '- Pick a country -'
              : '- Invalid country prefix -'
            : countryData()[this.state.country].emoji + ' ' + countryData()[this.state.country].name}
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

  private onSelectCountry = (code: string | undefined) => {
    this.setCountry(code ?? '', false)
    this.phoneInputRef.current && this.phoneInputRef.current.focus()
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.defaultCountry) {
      return null
    }

    if (!this.state.country && this.props.defaultCountry) {
      this.setState({
        country: this.props.defaultCountry,
        formatter: new AsYouTypeFormatter(this.props.defaultCountry),
        prefix: getCallingCode(this.props.defaultCountry).slice(1),
      })
    }

    return null
  }

  render() {
    // If country is falsey, the input is loading
    if (this.state.country === undefined) {
      return (
        <Kb.Box2
          direction={this.isSmall() ? 'horizontal' : 'vertical'}
          style={Styles.collapseStyles([
            this.isSmall() ? styles.containerSmall : styles.containerBig,
            styles.containerLoading,
          ])}
        >
          <Kb.ProgressIndicator type="Small" />
        </Kb.Box2>
      )
    }

    return (
      <Kb.Box2
        direction={this.isSmall() ? 'horizontal' : 'vertical'}
        style={Styles.collapseStyles([
          this.isSmall() ? styles.containerSmall : styles.containerBig,
          this.isSmall() && this.state.focused && styles.highlight,
        ])}
      >
        <Kb.Box2
          alignItems="center"
          direction="horizontal"
          style={
            this.isSmall()
              ? undefined
              : Styles.collapseStyles([styles.countrySelectorRowBig, styles.fakeInputBig])
          }
        >
          <Kb.ClickableBox
            onClick={this.toggleShowingMenu}
            style={this.isSmall() ? styles.fullWidthDesktopOnly : styles.fullWidth}
          >
            <Kb.Box2
              direction="horizontal"
              style={styles.countrySelectorContainer}
              alignItems="center"
              gap="xtiny"
              ref={this.props.setAttachmentRef}
            >
              {this.renderCountrySelector()}
              <Kb.Icon type="iconfont-caret-down" sizeType="Tiny" />
            </Kb.Box2>
          </Kb.ClickableBox>
        </Kb.Box2>
        <Kb.Box2
          direction="horizontal"
          gap={this.isSmall() ? undefined : 'tiny'}
          fullWidth={true}
          style={this.isSmall() ? Styles.globalStyles.flexOne : undefined}
        >
          {!this.isSmall() && (
            <Kb.Box2
              alignItems="center"
              direction="horizontal"
              style={Styles.collapseStyles([styles.prefixContainer, !this.isSmall() && styles.fakeInputBig])}
            >
              <Kb.Text type="BodySemibold" style={styles.prefixPlus}>
                {'+'}
              </Kb.Text>
              <Kb.PlainInput
                style={Styles.collapseStyles([
                  this.isSmall() ? styles.plainInputSmall : styles.plainInputBig,
                  styles.prefixInput,
                ])}
                flexable={true}
                keyboardType={isIOS ? 'number-pad' : 'numeric'}
                onChangeText={x => this.reformatPrefix(x, false)}
                maxLength={3}
                onEnterKeyDown={this.onPrefixEnter}
                returnKeyType="next"
                value={this.state.prefix}
              />
            </Kb.Box2>
          )}
          <Kb.Box2
            alignItems="center"
            direction="horizontal"
            style={Styles.collapseStyles([
              styles.phoneNumberContainer,
              !this.isSmall() && styles.fakeInputBig,
              !this.isSmall() && this.state.focused && styles.highlight,
            ])}
          >
            <Kb.PlainInput
              autoFocus={this.props.autoFocus}
              style={this.isSmall() ? styles.plainInputSmall : styles.plainInputBig}
              flexable={true}
              keyboardType={isIOS ? 'number-pad' : 'numeric'}
              placeholder={getPlaceholder(this.state.country)}
              onChangeText={x => this.reformatPhoneNumber(x, false)}
              onEnterKeyDown={this.props.onEnterKeyDown}
              onFocus={() => this.setState({focused: true})}
              onBlur={() => this.setState({focused: false})}
              value={this.state.formatted}
              disabled={!this.state.country}
              ref={this.phoneInputRef}
              maxLength={17}
              textContentType="telephoneNumber"
            />
            {this.props.onClear && (
              <Kb.Icon type="iconfont-remove" onClick={this.props.onClear} style={styles.clearIcon} />
            )}
          </Kb.Box2>
        </Kb.Box2>
        <CountrySelector
          attachTo={this.props.getAttachmentRef}
          onSelect={this.onSelectCountry}
          onHidden={this.toggleShowingMenu}
          selected={this.state.country}
          visible={this.props.showingMenu}
          ref={this.countrySelectorRef}
        />
      </Kb.Box2>
    )
  }
}
const PhoneInput = Kb.OverlayParentHOC(_PhoneInput)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      clearIcon: {
        marginRight: Styles.globalMargins.tiny,
      },
      containerBig: {
        width: '100%',
      },
      containerLoading: {
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
      },
      containerSmall: {
        backgroundColor: Styles.globalColors.white,
        borderColor: Styles.globalColors.black_10,
        borderRadius: Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        height: 38,
        width: '100%',
      },
      countryLayout: {
        maxHeight: 200,
        overflow: 'hidden',
        width: 240,
      },
      countryList: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.flexBoxColumn,
          display: 'block',
          maxHeight: 130,
          overflowX: 'hidden',
          overflowY: 'auto',
          paddingBottom: 0,
          paddingTop: 0,
        },
      }),
      countrySelector: {marginRight: Styles.globalMargins.xtiny},
      countrySelectorBig: {
        flexGrow: 1,
      },
      countrySelectorContainer: {
        ...Styles.padding(0, Styles.globalMargins.xsmall),
        borderRightColor: Styles.globalColors.black_10,
        borderRightWidth: 1,
        borderStyle: 'solid',
        height: 36,
      },
      countrySelectorRowBig: {
        marginBottom: Styles.globalMargins.tiny,
      },
      fakeInputBig: {
        backgroundColor: Styles.globalColors.white,
        borderColor: Styles.globalColors.black_10,
        borderRadius: Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        height: 48,
      },
      fullWidth: {width: '100%'},
      fullWidthDesktopOnly: Styles.platformStyles({isElectron: {width: '100%'}}),
      highlight: {borderColor: Styles.globalColors.blue, borderWidth: 1},
      menuItem: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xtiny),
      },
      phoneNumberContainer: {
        flexGrow: 1,
      },
      plainInputBig: {
        ...Styles.padding(0, Styles.globalMargins.small),
        backgroundColor: Styles.globalColors.transparent,
        height: 48,
      },
      plainInputSmall: {
        ...Styles.padding(0, Styles.globalMargins.xsmall),
        backgroundColor: Styles.globalColors.transparent,
        height: 36,
      },
      prefixContainer: {
        flexGrow: 0,
      },
      prefixInput: {
        textAlign: 'right',
      },
      prefixPlus: {
        paddingLeft: Styles.globalMargins.small,
      },
      searchWrapper: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny),
      },
    } as const)
)

export default PhoneInput
