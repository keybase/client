import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/wallets'
import * as Styles from '../../../../styles'
import {Props} from './index.types'

const headerKey = '_header'

const makeDropdownItems = (currencies: I.List<Types.Currency>, currency: Types.Currency) => {
  const items = [
    <Kb.Box2 centerChildren={true} direction="vertical" key={headerKey}>
      <Kb.Text center={true} type="BodySmall" style={styles.dropdownHeader}>
        Past transactions won't be affected by this change.
      </Kb.Text>
    </Kb.Box2>,
  ]
  // spread the List into an array with [...]
  return items.concat([...currencies].map(s => makeDropdownItem(s, s.code === currency.code)))
}

const makeDropdownItem = (item: Types.Currency, isSelected: boolean, waiting?: boolean) => (
  <Kb.Box2 centerChildren={true} direction="vertical" fullWidth={true} key={item.code}>
    {item.description && !waiting ? (
      <Kb.Text
        center={true}
        type="BodyBig"
        style={Styles.collapseStyles([isSelected && styles.itemSelected])}
      >
        {item.description}
      </Kb.Text>
    ) : (
      <Kb.ProgressIndicator type="Small" style={styles.progressIndicator} />
    )}
  </Kb.Box2>
)

const DisplayCurrencyDropdown = (props: Props) => {
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.container}>
      <Kb.Dropdown
        disabled={props.waiting}
        items={makeDropdownItems(props.currencies, props.selected)}
        selected={makeDropdownItem(props.selected, false, props.waiting)}
        onChanged={(node: React.ReactNode) => {
          // @ts-ignore doesn't understand key will be string
          const selectedCode: Types.CurrencyCode = node.key
          if (selectedCode !== props.selected.code && selectedCode !== headerKey) {
            props.onCurrencyChange(selectedCode)
          }
        }}
        style={styles.dropdown}
      />
      <Kb.SaveIndicator saving={props.saveCurrencyWaiting} minSavingTimeMs={300} savedTimeoutMs={2500} />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: {alignItems: 'center', justifyContent: 'flex-start'},
  dropdown: {
    alignItems: 'center',
    flexShrink: 1,
    marginBottom: Styles.globalMargins.xtiny,
  },
  dropdownHeader: {padding: Styles.globalMargins.xsmall},
  itemSelected: {color: Styles.globalColors.blueDark},
  progressIndicator: {
    height: 17,
    width: 17,
  },
})

export default DisplayCurrencyDropdown
