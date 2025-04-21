import * as React from 'react'
import * as Styles from '@/styles'
import Emoji from './emoji'
import Text from './text'
import {Box2, Box2Measure} from './box'
import FloatingMenu from './floating-menu'
import SearchFilter from './search-filter'
import PlainInput, {type PlainInputRef} from './plain-input'
import FloatingPicker from './floating-picker'
import ProgressIndicator from './progress-indicator'
import ClickableBox from './clickable-box'
import Icon from './icon'
import {usePopup2, type Popup2Parms} from './use-popup'
import {isIOS, isMobile} from '@/constants/platform'
import {
  countryData,
  codeToCountry,
  areaCodeIsCanadian,
  AsYouTypeFormatter,
  validateNumber,
  type CountryData,
} from '@/util/phone-numbers'
import type {MeasureRef} from './measure-ref'

const Kb = {
  Box2,
  Box2Measure,
  ClickableBox,
  Emoji,
  FloatingMenu,
  FloatingPicker,
  Icon,
  PlainInput,
  ProgressIndicator,
  SearchFilter,
  Text,
  usePopup2,
}

const normalizeCountryCode = (countryCode: string) =>
  countryCode.endsWith('?') ? countryCode.slice(0, -1) : countryCode
const getCallingCode = (countryCode: string) =>
  countryCode !== '' ? (countryData()[normalizeCountryCode(countryCode)]?.callingCode ?? '') : ''
const getCountryEmoji = (countryCode: string) => (
  <Kb.Emoji size={16} emojiName={countryData()[normalizeCountryCode(countryCode)]?.emojiText ?? ''} />
)
const getPlaceholder = (countryCode: string) =>
  countryCode !== '' ? 'Ex: ' + (countryData()[normalizeCountryCode(countryCode)]?.example ?? 'N/A') : 'N/A'
const filterNumeric = (text: string) => text.replace(/[^\d]/g, '')
const prioritizedCountries = ['US', 'CA', 'GB']

const pickerItems = (countryData: {[key: string]: CountryData}) =>
  [
    ...prioritizedCountries.map(code => countryData[code]),
    ...Object.values(countryData)
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
  ].map(cd => ({label: cd?.pickerText ?? '', value: cd?.alpha2 ?? ''}))
const menuItems = (
  countryData: {
    [key: string]: CountryData
  },
  filter: string,
  onClick: (selected: string) => void
) => {
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
        const countryName = countryData[country]?.name
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
}

const MenuItem = (props: {emoji: string; text: string}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItem} gap="xtiny" alignItems="center">
    <Kb.Text type="Body" center={true}>
      <Kb.Emoji size={18} emojiName={props.emoji} />
    </Kb.Text>
    <Kb.Text type="BodySemibold">{props.text}</Kb.Text>
  </Kb.Box2>
)

type CountrySelectorProps = {
  attachTo?: React.RefObject<MeasureRef>
  onSelect: (s?: string) => void
  onHidden: () => void
  selected?: string
  visible: boolean
}

type CountrySelectorRef = {
  clearFilter: () => void
  onSelectMenu: (s: string) => void
}

const CountrySelector = React.forwardRef<CountrySelectorRef, CountrySelectorProps>((p, ref) => {
  const {onHidden, onSelect, selected: _selected, visible, attachTo} = p
  const [filter, setFilter] = React.useState('')
  const [selected, setSelected] = React.useState(_selected)

  const clearFilter = React.useCallback(() => {
    setFilter('')
  }, [])

  const onSelectMenu = p.onSelect

  React.useImperativeHandle(
    ref,
    () => ({
      clearFilter,
      onSelectMenu,
    }),
    [clearFilter, onSelectMenu]
  )

  const onCancel = React.useCallback(() => {
    setSelected(p.selected)
    onHidden()
  }, [p.selected, onHidden])

  const onDone = React.useCallback(() => {
    if (!selected) {
      return
    }
    onSelect(selected)
    onHidden()
  }, [onSelect, onHidden, selected])

  React.useEffect(() => {
    setSelected(_selected)
  }, [_selected])

  const desktopItemsRef = React.useRef<
    Array<{alpha2: string; onClick: () => void; title: string; view: React.ReactNode}> | undefined
  >()
  const mobileItemsRef = React.useRef<Array<{label: string; value: string}> | undefined>()

  const onSelectFirst = () => {
    if (Styles.isMobile && mobileItemsRef.current?.[0]) {
      onSelectMenu(mobileItemsRef.current[0].value)
    } else if (desktopItemsRef.current?.[0]) {
      onSelectMenu(desktopItemsRef.current[0].alpha2)
    }
    onHidden()
  }
  if (!isMobile) {
    desktopItemsRef.current = menuItems(countryData(), filter, onSelectMenu)
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
              onChange={setFilter}
              placeholderText="Search"
              focusOnMount={true}
              onEnterKeyDown={onSelectFirst}
            />
          </Kb.Box2>
        }
        items={desktopItemsRef.current}
        listStyle={styles.countryList}
        onHidden={onHidden}
        visible={visible}
        attachTo={attachTo}
      />
    )
  }
  mobileItemsRef.current = pickerItems(countryData())
  return (
    <Kb.FloatingPicker
      items={mobileItemsRef.current}
      onSelect={setSelected}
      onHidden={onCancel}
      onCancel={onCancel}
      onDone={onDone}
      selectedValue={selected}
      visible={visible}
    />
  )
})

type Props = {
  autoFocus?: boolean
  defaultCountry?: string
  onChangeNumber: (phoneNumber: string, valid: boolean) => void
  onEnterKeyDown?: (e?: React.KeyboardEvent) => void
  onClear?: () => void
  small?: boolean // default is true on desktop and false on mobile
  style?: Styles.StylesCrossPlatform
}

const PhoneInput = (p: Props) => {
  const {onChangeNumber, onClear, small, autoFocus, onEnterKeyDown} = p
  const [country, setCountry] = React.useState(p.defaultCountry)
  const [focused, setFocused] = React.useState(false)
  const [formatted, setFormatted] = React.useState('')
  const [formatter, setFormatter] = React.useState<libphonenumber.AsYouTypeFormatter | undefined>(
    p.defaultCountry ? new AsYouTypeFormatter(p.defaultCountry) : undefined
  )
  const [prefix, setPrefix] = React.useState(p.defaultCountry && getCallingCode(p.defaultCountry).slice(1))

  const phoneInputRef = React.useRef<PlainInputRef | null>(null)
  const countrySelectorRef = React.useRef<CountrySelectorRef | null>(null)

  // AsYouTypeFormatter doesn't support backspace
  // To get around this, on every text change:
  // 1. Clear the formatter
  // 2. Remove any non-numerics from the text
  // 3. Feed the new text into the formatter char by char
  // 4. Set the value of the input to the new formatted
  const reformatPhoneNumberSkipCountry = React.useCallback(
    (_newText: string) => {
      if (!formatter) {
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

      formatter.clear()
      newText = filterNumeric(newText)

      if (newText.trim().length === 0) {
        setFormatted('')
        return
      }
      for (let i = 0; i < newText.length - 1; i++) {
        formatter.inputDigit(newText[i]!)
      }
      const formatted = formatter.inputDigit(newText.at(-1)!)
      setFormatted(formatted)
    },
    [formatter]
  )

  const setCountry2NoKeepPrefix = React.useCallback(
    (_country: string) => {
      let c = _country
      if (country !== c) {
        c = normalizeCountryCode(c)

        setCountry(c)
        setFormatter(c ? new AsYouTypeFormatter(c) : undefined)

        // Special behaviour for NA numbers
        if (getCallingCode(c).length === 6) {
          reformatPhoneNumberSkipCountry(getCallingCode(c).slice(-3))
        } else {
          reformatPhoneNumberSkipCountry('')
        }

        const _newText = getCallingCode(c).slice(1)
        let newText = filterNumeric(_newText)
        // NA countries that use area codes require special behaviour
        if (newText.length === 4) {
          newText = newText[0]!
        }
        setPrefix(newText)
      }
    },
    [country, reformatPhoneNumberSkipCountry]
  )

  const onSelectCountry = React.useCallback(
    (code: string | undefined) => {
      setCountry2NoKeepPrefix(code ?? '')
      phoneInputRef.current?.focus()
    },
    [setCountry2NoKeepPrefix]
  )

  const {defaultCountry} = p

  const _toggleShowingMenu = React.useCallback(
    (hidePopup: () => void) => {
      if (!country && defaultCountry) {
        countrySelectorRef.current?.onSelectMenu(defaultCountry)
      }
      countrySelectorRef.current?.clearFilter()
      hidePopup()
    },
    [country, defaultCountry]
  )

  const makePopup = React.useCallback(
    (p: Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <CountrySelector
          attachTo={attachTo}
          onSelect={onSelectCountry}
          onHidden={() => _toggleShowingMenu(hidePopup)}
          selected={country}
          visible={true}
          ref={countrySelectorRef}
        />
      )
    },
    [country, onSelectCountry, _toggleShowingMenu]
  )

  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  const toggleShowingMenu = React.useCallback(() => {
    _toggleShowingMenu(showPopup)
  }, [_toggleShowingMenu, showPopup])

  const lastFormattedRef = React.useRef(formatted)
  React.useEffect(() => {
    if (lastFormattedRef.current !== formatted) {
      lastFormattedRef.current = formatted
      const validation = validateNumber(formatted, country)
      onChangeNumber(validation.e164, validation.valid)
    }
  }, [formatted, onChangeNumber, country])

  const lastDefaultCountryRef = React.useRef(defaultCountry)

  React.useEffect(() => {
    if (lastDefaultCountryRef.current) {
      return
    }
    lastDefaultCountryRef.current = defaultCountry
    if (!country && defaultCountry) {
      setCountry(defaultCountry)
      setFormatter(new AsYouTypeFormatter(defaultCountry))
      setPrefix(getCallingCode(defaultCountry).slice(1))
    }
  }, [country, defaultCountry])

  const isSmall = small ?? !Styles.isMobile

  // If country is falsey, the input is loading
  if (country === undefined) {
    return (
      <Kb.Box2
        direction={isSmall ? 'horizontal' : 'vertical'}
        style={Styles.collapseStyles([
          isSmall ? styles.containerSmall : styles.containerBig,
          styles.containerLoading,
        ])}
      >
        <Kb.ProgressIndicator type="Small" />
      </Kb.Box2>
    )
  }

  const reformatPhoneNumberNoSkipCountry = (_newText: string) => {
    if (!formatter) {
      return
    }

    const setCountry2KeepPrefix = (_country: string) => {
      let c = _country
      if (country !== c) {
        c = normalizeCountryCode(c)

        setCountry(c)
        setFormatter(c ? new AsYouTypeFormatter(c) : undefined)

        // Special behaviour for NA numbers
        if (getCallingCode(c).length === 6) {
          reformatPhoneNumberSkipCountry(getCallingCode(c).slice(-3))
        }

        const _newText = getCallingCode(c).slice(1)
        let newText = filterNumeric(_newText)
        // NA countries that use area codes require special behaviour
        if (newText.length === 4) {
          newText = newText[0]!
        }
        setPrefix(newText)
      }
    }

    let newText = _newText

    // ACME DIGIT REMOVAL MACHINE 5000
    // This code works around iOS not letting you accurately move your cursor
    // anymore. Fixes editing "middle" numbers in the phone number input.
    // 1) It doesn't run in reformats with skipCountry:true
    // 2) It only runs when the total length decreased
    // 3) It only runs when we had formatted text before
    // 4) It should not do anything if it wasn't a whitespace change in the middle
    if (newText.length < formatted.length && formatted.length !== 0) {
      // Look at the new text and figure out which character is different
      let diffIndex: number = -1
      for (let i = 0; i < newText.length; i++) {
        if (i + 1 > formatted.length || newText[i] !== formatted[i]) {
          diffIndex = i
          break
        }
      }

      // Make sure that the change was in the middle of the text
      if (diffIndex !== -1 && diffIndex + 1 <= formatted.length) {
        // Look at the original character at that location
        const changedChar = formatted[diffIndex]

        // Make sure that the changed char isn't a number
        if (isNaN(parseInt(changedChar ?? '', 10))) {
          // At this point we're certain we're in the special scenario.

          // Take everything BUT the different character, make it all numbers
          const beforeDiff = filterNumeric(newText.substring(0, diffIndex))
          // We don't care about what's in the section that includes the difference
          const afterDiff = newText.substring(diffIndex)

          // Combine it back into a newText, slicing off the last character of beforeDiff
          newText = beforeDiff.slice(0, -1).concat(afterDiff)
        }
      }
    }

    formatter.clear()
    newText = filterNumeric(newText)

    if (newText.trim().length === 0) {
      setFormatted('')
      return
    }
    for (let i = 0; i < newText.length - 1; i++) {
      formatter.inputDigit(newText[i]!)
    }
    setFormatted(formatter.inputDigit(newText.at(-1)!))

    // Special case for NA area
    if (prefix === '1') {
      // Only numeric, trimmed from whitespace
      const trimmedText = newText.trim()
      // If the area code is present...
      if (trimmedText.length >= 3) {
        // Prepare the potential 4 number prefix
        const areaCode = trimmedText.slice(0, 3)
        const extPrefix = prefix + ' ' + areaCode

        // First look it up against the table
        const possibleMatch = codeToCountry()[extPrefix]
        if (possibleMatch) {
          setCountry2NoKeepPrefix(possibleMatch)
        } else if (areaCodeIsCanadian(areaCode)) {
          // Otherwise determine the country using the hardcoded ranges
          setCountry2KeepPrefix('CA')
        } else {
          setCountry2KeepPrefix('US')
        }
      }
    }
  }

  const renderCountrySelector = () => {
    const isSmall = small ?? !Styles.isMobile
    if (!isSmall) {
      return (
        <Kb.Text
          type="BodySemibold"
          style={Styles.collapseStyles([styles.countrySelector, styles.countrySelectorBig])}
        >
          {!country
            ? !prefix
              ? '- Pick a country -'
              : '- Invalid country prefix -'
            : countryData()[country]?.emoji + ' ' + countryData()[country]?.name}
        </Kb.Text>
      )
    }

    return (
      <>
        <Kb.Text type="Body" style={styles.countrySelector}>
          {getCountryEmoji(country)}
        </Kb.Text>
        <Kb.Text type="BodySemibold" style={styles.countrySelector}>
          {'+' + prefix}
        </Kb.Text>
      </>
    )
  }

  return (
    <Kb.Box2
      direction={isSmall ? 'horizontal' : 'vertical'}
      style={Styles.collapseStyles([
        isSmall ? styles.containerSmall : styles.containerBig,
        isSmall && focused && styles.highlight,
      ])}
    >
      <Kb.Box2
        alignItems="center"
        direction="horizontal"
        style={
          isSmall ? undefined : Styles.collapseStyles([styles.countrySelectorRowBig, styles.fakeInputBig])
        }
      >
        <Kb.ClickableBox
          onClick={toggleShowingMenu}
          style={isSmall ? styles.fullWidthDesktopOnly : styles.fullWidth}
        >
          <Kb.Box2Measure
            direction="horizontal"
            style={styles.countrySelectorContainer}
            alignItems="center"
            gap="xtiny"
            ref={popupAnchor}
          >
            {renderCountrySelector()}
            <Kb.Icon type="iconfont-caret-down" sizeType="Tiny" />
          </Kb.Box2Measure>
        </Kb.ClickableBox>
      </Kb.Box2>
      <Kb.Box2
        direction="horizontal"
        gap={isSmall ? undefined : 'tiny'}
        fullWidth={true}
        style={isSmall ? Styles.globalStyles.flexOne : undefined}
      >
        {!isSmall && (
          <Kb.Box2
            alignItems="center"
            direction="horizontal"
            style={Styles.collapseStyles([styles.prefixContainer, styles.fakeInputBig])}
          >
            <Kb.Text type="BodySemibold" style={styles.prefixPlus}>
              {'+'}
            </Kb.Text>
            <Kb.PlainInput
              style={Styles.collapseStyles([styles.plainInputBig, styles.prefixInput])}
              flexable={true}
              keyboardType={isIOS ? 'number-pad' : 'numeric'}
              onChangeText={_newText => {
                let newText = filterNumeric(_newText)
                const matchedCountry = codeToCountry()[newText]
                if (matchedCountry) {
                  setCountry2NoKeepPrefix(matchedCountry)
                } else {
                  // Invalid country
                  setCountry2NoKeepPrefix('')
                }

                // NA countries that use area codes require special behaviour
                if (newText.length === 4) {
                  newText = newText[0]!
                }
                setPrefix(newText)
              }}
              maxLength={3}
              onEnterKeyDown={() => {
                phoneInputRef.current && phoneInputRef.current.focus()
              }}
              returnKeyType="next"
              value={prefix}
            />
          </Kb.Box2>
        )}
        <Kb.Box2
          alignItems="center"
          direction="horizontal"
          style={Styles.collapseStyles([
            styles.phoneNumberContainer,
            !isSmall && styles.fakeInputBig,
            !isSmall && focused && styles.highlight,
          ])}
        >
          <Kb.PlainInput
            autoFocus={autoFocus}
            style={isSmall ? styles.plainInputSmall : styles.plainInputBig}
            flexable={true}
            keyboardType={isIOS ? 'number-pad' : 'numeric'}
            placeholder={getPlaceholder(country)}
            onChangeText={x => reformatPhoneNumberNoSkipCountry(x)}
            onEnterKeyDown={onEnterKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            value={formatted}
            disabled={!country}
            ref={phoneInputRef}
            maxLength={17}
            textContentType="telephoneNumber"
          />
          {onClear && <Kb.Icon type="iconfont-remove" onClick={onClear} style={styles.clearIcon} />}
        </Kb.Box2>
      </Kb.Box2>
      {popup}
    </Kb.Box2>
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
    }) as const
)

export default PhoneInput
