import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import type * as Types from '../../../../constants/types/wallets'
import * as Styles from '../../../../styles'
import type {Props} from '.'

const headerKey = '_header'

const makeDropdownItems = (currencies: Array<Types.Currency>, currency: Types.Currency) => {
  const items = [
    <Kb.Box2 centerChildren={true} direction="vertical" key={headerKey}>
      <Kb.Text center={true} type="BodySmall" style={styles.dropdownHeader}>
        Past transactions won't be affected by this change.
      </Kb.Text>
    </Kb.Box2>,
  ]
  // spread the List into an array with [...]
  return items.concat([...currencies].map(s => makeDropdownItem(s, s.code === currency.code, false, true)))
}

const makeDropdownItem = (
  item: Types.Currency,
  isSelected: boolean,
  waiting?: boolean,
  isListItem?: boolean
) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    key={item.code}
    style={Styles.collapseStyles([styles.itemContainer, isListItem && styles.listItemContainer])}
  >
    {item.description && !waiting ? (
      <Kb.Text type="BodyBig" style={Styles.collapseStyles([isSelected && styles.itemSelected])}>
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {alignItems: 'center', justifyContent: 'flex-start'},
      dropdown: {
        alignItems: 'center',
        flexShrink: 1,
        marginBottom: Styles.globalMargins.xtiny,
      },
      dropdownHeader: {padding: Styles.globalMargins.xsmall},
      itemContainer: {paddingLeft: Styles.globalMargins.xsmall},
      itemSelected: {color: Styles.globalColors.blueDark},
      listItemContainer: {justifyContent: 'center', width: '100%'},
      progressIndicator: {
        height: 17,
        width: 17,
      },
    } as const)
)

export default DisplayCurrencyDropdown
