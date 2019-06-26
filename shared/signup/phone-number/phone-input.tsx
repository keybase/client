import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isIOS} from '../../constants/platform'
import {countryData, AsYouTypeFormatter, validateNumber} from '../../util/phone-numbers/'
import {memoize} from '../../util/memoize'

const getCallingCode = countryCode => countryData[countryCode].callingCode
const getCountryEmoji = countryCode => countryData[countryCode].emoji
const getPlaceholder = countryCode => 'Ex: ' + countryData[countryCode].example
const filterNumeric = text => text.replace(/[^0-9]/g, '')
const defaultCountry = 'US'
const pickerItems = memoize(countryData =>
  Object.values(countryData)
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
    .map((cd: any) => ({label: cd.pickerText, value: cd.alpha2}))
)
const menuItems = memoize((countryData, filter, onClick) =>
  Object.values(countryData)
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
    .filter((cd: any) => {
      const strippedFilter = filter.replace(/[^\d+]/g, '')
      return (
        (strippedFilter.length > 0 && cd.callingCode.replace(/[^\d+]/g, '').includes(strippedFilter)) ||
        cd.pickerText.toLowerCase().includes(filter.toLowerCase())
      )
    })
    .map((cd: any) => ({
      onClick: () => onClick(cd.alpha2),
      title: cd.pickerText,
      view: <MenuItem text={cd.pickerText} />,
    }))
)

const MenuItem = props => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItem}>
    <Kb.Text type="BodySemibold">{props.text}</Kb.Text>
  </Kb.Box2>
)

type CountrySelectorProps = {
  attachTo: () => React.Component<any> | null
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

  _onSelect = selected => this.setState(s => (s.selected === selected ? null : {...s, selected}))

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

  _onChangeFilter = filter => this.setState(s => ({...s, filter}))

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
                />
              </Kb.Box2>
            ),
          }}
          items={menuItems(countryData, this.state.filter, this._onSelectMenu)}
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
  _countrySelectorRef = React.createRef<CountrySelector>()

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

  _toggleShowingMenu = () => {
    this._countrySelectorRef.current.clearFilter()
    this.props.toggleShowingMenu()
  }

  render() {
    return (
      <>
        <Kb.Box2
          alignItems="center"
          direction="horizontal"
          style={Styles.collapseStyles([styles.container, this.props.style])}
        >
          <Kb.ClickableBox onClick={this._toggleShowingMenu} style={styles.fullHeight}>
            <Kb.Box2
              direction="horizontal"
              style={styles.callingCodeContainer}
              alignItems="center"
              fullHeight={true}
              gap="small"
              ref={this.props.setAttachmentRef}
            >
              <Kb.Text type="BodySemibold">
                {getCountryEmoji(this.state.country)} {getCallingCode(this.state.country)}
              </Kb.Text>
              <Kb.Icon type="iconfont-caret-down" sizeType="Tiny" />
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
          onHidden={this._toggleShowingMenu}
          selected={this.state.country}
          visible={this.props.showingMenu}
          ref={this._countrySelectorRef}
        />
      </>
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
  countrySearch: {
    ...Styles.globalStyles.flexBoxRow,
    ...Styles.padding(0, Styles.globalMargins.tiny),
    flexShrink: 0,
    height: 38,
    width: '100%',
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
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xtiny),
  },
  searchWrapper: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny),
  },
})

export default PhoneInput
