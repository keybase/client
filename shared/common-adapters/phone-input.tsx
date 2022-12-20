import * as React from 'react'
import * as Styles from '../styles'
import Emoji from './emoji'
import Text from './text'
import {Box2} from './box'
import FloatingMenu from './floating-menu'
import SearchFilter from './search-filter'
import PlainInput from './plain-input'
import FloatingPicker from './floating-picker'
import ProgressIndicator from './progress-indicator'
import ClickableBox from './clickable-box'
import Icon from './icon'
import {usePopup} from './use-popup'
import {isIOS, isMobile} from '../constants/platform'
import {
  countryData,
  codeToCountry,
  areaCodeIsCanadian,
  AsYouTypeFormatter,
  validateNumber,
  type CountryData,
} from '../util/phone-numbers'
import {memoize} from '../util/memoize'

const Kb = {
  Box2,
  ClickableBox,
  Emoji,
  FloatingMenu,
  FloatingPicker,
  Icon,
  PlainInput,
  ProgressIndicator,
  SearchFilter,
  Text,
  usePopup,
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
  selected: string | undefined | null
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

  private onSelect = (selected: string | null | undefined) =>
    this.setState(s => (s.selected === selected ? null : {selected}))

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

type OldProps = Props & {
  popup: any
  popupAnchor: any
  country: string | undefined
  setCountry: React.Dispatch<React.SetStateAction<string | undefined>>
  focused: boolean
  setFocused: React.Dispatch<React.SetStateAction<boolean>>
  formatted: string
  setFormatted: React.Dispatch<React.SetStateAction<string>>
  formatter?: libphonenumber.AsYouTypeFormatter
  setFormatter: React.Dispatch<React.SetStateAction<libphonenumber.AsYouTypeFormatter | undefined>>
  prefix: string | undefined
  setPrefix: React.Dispatch<React.SetStateAction<string | undefined>>
  phoneInputRef: React.MutableRefObject<PlainInput | null>
  countrySelectorRef: React.MutableRefObject<CountrySelector | null>
  toggleShowingMenu: () => void
}

class _PhoneInput extends React.Component<OldProps> {
  private setFormattedPhoneNumber = (formatted: string) => this.props.setFormatted(formatted)
  // TODO
  // }, this.updateParent)

  // AsYouTypeFormatter doesn't support backspace
  // To get around this, on every text change:
  // 1. Clear the formatter
  // 2. Remove any non-numerics from the text
  // 3. Feed the new text into the formatter char by char
  // 4. Set the value of the input to the new formatted
  private reformatPhoneNumber = (_newText: string, skipCountry: boolean) => {
    if (!this.props.formatter) {
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
    if (!skipCountry && newText.length < this.props.formatted.length && this.props.formatted.length !== 0) {
      // Look at the new text and figure out which character is different
      let diffIndex: number = -1
      for (let i = 0; i < newText.length; i++) {
        if (i + 1 > this.props.formatted.length || newText[i] !== this.props.formatted[i]) {
          diffIndex = i
          break
        }
      }

      // Make sure that the change was in the middle of the text
      if (diffIndex !== -1 && diffIndex + 1 <= this.props.formatted.length) {
        // Look at the original character at that location
        const changedChar = this.props.formatted[diffIndex]

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

    this.props.formatter.clear()
    newText = filterNumeric(newText)

    if (newText.trim().length === 0) {
      this.setFormattedPhoneNumber('')
      return
    }
    for (let i = 0; i < newText.length - 1; i++) {
      this.props.formatter.inputDigit(newText[i])
    }
    const formatted = this.props.formatter.inputDigit(newText[newText.length - 1])
    this.setFormattedPhoneNumber(formatted)

    // Special case for NA area
    if (this.props.prefix === '1' && !skipCountry) {
      // Only numeric, trimmed from whitespace
      const trimmedText = newText.trim()
      // If the area code is present...
      if (trimmedText.length >= 3) {
        // Prepare the potential 4 number prefix
        const areaCode = trimmedText.slice(0, 3)
        const extPrefix = this.props.prefix + ' ' + areaCode

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
    this.props.setPrefix(newText)
  }

  setCountry = (country: string, keepPrefix: boolean) => {
    if (this.props.country !== country) {
      country = normalizeCountryCode(country)

      this.props.setCountry(country)
      this.props.setFormatter(country ? new AsYouTypeFormatter(country) : undefined)

      // Special behaviour for NA numbers
      if (getCallingCode(country).length === 6) {
        this.reformatPhoneNumber(getCallingCode(country).slice(-3), true)
      } else if (!keepPrefix) {
        this.reformatPhoneNumber('', true)
      }
      this.reformatPrefix(getCallingCode(country).slice(1), true)
    }
  }

  private onPrefixEnter = () => {
    this.props.phoneInputRef.current && this.props.phoneInputRef.current.focus()
  }

  private isSmall = () => {
    return this.props.small ?? !Styles.isMobile
  }

  private renderCountrySelector = () => {
    if (this.props.country === undefined) {
      return null
    }

    if (!this.isSmall()) {
      return (
        <Kb.Text
          type="BodySemibold"
          style={Styles.collapseStyles([styles.countrySelector, styles.countrySelectorBig])}
        >
          {!this.props.country
            ? !this.props.prefix
              ? '- Pick a country -'
              : '- Invalid country prefix -'
            : countryData()[this.props.country].emoji + ' ' + countryData()[this.props.country].name}
        </Kb.Text>
      )
    }

    return (
      <>
        <Kb.Text type="Body" style={styles.countrySelector}>
          {getCountryEmoji(this.props.country)}
        </Kb.Text>
        <Kb.Text type="BodySemibold" style={styles.countrySelector}>
          {'+' + this.props.prefix}
        </Kb.Text>
      </>
    )
  }

  componentDidUpdate(prevProps: OldProps) {
    if (this.props.formatted !== prevProps.formatted) {
      const validation = validateNumber(this.props.formatted, this.props.country)
      this.props.onChangeNumber(validation.e164, validation.valid)
    }

    if (prevProps.defaultCountry) {
      return null
    }

    if (!this.props.country && this.props.defaultCountry) {
      this.props.setCountry(this.props.defaultCountry)
      this.props.setFormatter(new AsYouTypeFormatter(this.props.defaultCountry))
      this.props.setPrefix(getCallingCode(this.props.defaultCountry).slice(1))
    }

    return null
  }

  render() {
    // If country is falsey, the input is loading
    if (this.props.country === undefined) {
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
          this.isSmall() && this.props.focused && styles.highlight,
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
            onClick={this.props.toggleShowingMenu}
            style={this.isSmall() ? styles.fullWidthDesktopOnly : styles.fullWidth}
          >
            <Kb.Box2
              direction="horizontal"
              style={styles.countrySelectorContainer}
              alignItems="center"
              gap="xtiny"
              ref={this.props.popupAnchor}
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
                value={this.props.prefix}
              />
            </Kb.Box2>
          )}
          <Kb.Box2
            alignItems="center"
            direction="horizontal"
            style={Styles.collapseStyles([
              styles.phoneNumberContainer,
              !this.isSmall() && styles.fakeInputBig,
              !this.isSmall() && this.props.focused && styles.highlight,
            ])}
          >
            <Kb.PlainInput
              autoFocus={this.props.autoFocus}
              style={this.isSmall() ? styles.plainInputSmall : styles.plainInputBig}
              flexable={true}
              keyboardType={isIOS ? 'number-pad' : 'numeric'}
              placeholder={getPlaceholder(this.props.country)}
              onChangeText={x => this.reformatPhoneNumber(x, false)}
              onEnterKeyDown={this.props.onEnterKeyDown}
              onFocus={() => this.props.setFocused(true)}
              onBlur={() => this.props.setFocused(false)}
              value={this.props.formatted}
              disabled={!this.props.country}
              ref={this.props.phoneInputRef}
              maxLength={17}
              textContentType="telephoneNumber"
            />
            {this.props.onClear && (
              <Kb.Icon type="iconfont-remove" onClick={this.props.onClear} style={styles.clearIcon} />
            )}
          </Kb.Box2>
        </Kb.Box2>
        {this.props.popup}
      </Kb.Box2>
    )
  }
}

const PhoneInput = (p: Props) => {
  const [country, setCountry] = React.useState(p.defaultCountry)
  const [focused, setFocused] = React.useState(false)
  const [formatted, setFormatted] = React.useState('')
  const [formatter, setFormatter] = React.useState<libphonenumber.AsYouTypeFormatter | undefined>(
    p.defaultCountry ? new AsYouTypeFormatter(p.defaultCountry) : undefined
  )
  const [prefix, setPrefix] = React.useState(p.defaultCountry && getCallingCode(p.defaultCountry).slice(1))

  const oldRef = React.useRef<_PhoneInput | null>(null)
  const phoneInputRef = React.useRef<PlainInput | null>(null)
  const countrySelectorRef = React.useRef<CountrySelector | null>(null)

  const onSelectCountry = React.useCallback((code: string | undefined) => {
    oldRef.current?.setCountry(code ?? '', false)
    phoneInputRef.current?.focus()
  }, [])

  const {defaultCountry} = p

  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <CountrySelector
      attachTo={attachTo}
      onSelect={onSelectCountry}
      onHidden={toggleShowingMenu}
      selected={country}
      visible={showingPopup}
      ref={countrySelectorRef}
    />
  ))

  const toggleShowingMenu = React.useCallback(() => {
    if (!country && defaultCountry) {
      countrySelectorRef.current?.onSelectMenu(defaultCountry)
    }
    countrySelectorRef.current?.clearFilter()
    toggleShowingPopup()
  }, [country, defaultCountry, toggleShowingPopup])

  // this component is a mess. Has a lot of circular logic in the helpers which can't be easily hookified and i don't
  // want to rewrite this now
  return (
    <_PhoneInput
      {...p}
      ref={oldRef}
      popup={popup}
      popupAnchor={popupAnchor}
      countrySelectorRef={countrySelectorRef}
      country={country}
      setCountry={setCountry}
      focused={focused}
      setFocused={setFocused}
      formatted={formatted}
      setFormatted={setFormatted}
      formatter={formatter}
      setFormatter={setFormatter}
      prefix={prefix}
      setPrefix={setPrefix}
      phoneInputRef={phoneInputRef}
      toggleShowingMenu={toggleShowingMenu}
    />
  )
}

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
