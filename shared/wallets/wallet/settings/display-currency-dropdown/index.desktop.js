// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/wallets'
import * as Styles from '../../../../styles'
import type {Props} from './index.types'

const headerKey = '_header'

const makeDropdownItems = (currencies: I.List<Types.Currency>, currency: Types.Currency) => {
  const items = [
    <Kb.Box2 centerChildren={true} direction="vertical" key={headerKey}>
      <Kb.Text type="BodySmall" style={styles.dropdownHeader}>
        Past transactions won't be affected by this change.
      </Kb.Text>
    </Kb.Box2>,
  ]
  // spread the List into an array with [...]
  return items.concat([...currencies].map(s => makeDropdownItem(s, s.code === currency.code)))
}

const makeDropdownItem = (item: Types.Currency, isSelected: boolean) => (
  <Kb.Box2 centerChildren={true} direction="vertical" fullWidth={true} key={item.code}>
    <Kb.Text
      type="BodyBig"
      style={Styles.collapseStyles([styles.centerText, isSelected && styles.itemSelected])}
    >
      {item.description}
    </Kb.Text>
  </Kb.Box2>
)

const DisplayCurrencyDropdown = (props: Props) => {
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.container}>
      <Kb.Dropdown
        disabled={props.waiting}
        items={makeDropdownItems(props.currencies, props.selected)}
        selected={makeDropdownItem(props.selected, false)}
        onChanged={(node: React.Node) => {
          // $ForceType doesn't understand key will be string
          const selectedCode: Types.CurrencyCode = node.key
          if (selectedCode !== props.selected.code && selectedCode !== headerKey) {
            props.onCurrencyChange(selectedCode)
          }
        }}
        style={styles.dropdown}
      />
      {!Styles.isMobile && (
        <Kb.SaveIndicator saving={props.waiting} minSavingTimeMs={300} savedTimeoutMs={2500} />
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  centerText: {
    textAlign: 'center',
  },
  container: {alignItems: 'center', justifyContent: 'flex-start'},
  dropdown: {
    alignItems: 'center',
    marginBottom: Styles.globalMargins.xtiny,
    flexShrink: 1,
  },
  dropdownHeader: {
    textAlign: 'center',
    padding: Styles.globalMargins.xsmall,
  },
  itemSelected: {
    color: Styles.globalColors.blue,
  },
})

export default DisplayCurrencyDropdown
