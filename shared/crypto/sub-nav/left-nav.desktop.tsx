import * as Kb from '@/common-adapters'
import * as Crypto from '@/constants/crypto'
import NavRow from './nav-row'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

type Row = (typeof Crypto.Tabs)[number] & {
  isSelected: boolean
  key: string
}

type Props = {
  onClick: (a: string) => void
  selected: string
}

const LeftNav = (props: Props) => {
  const rows = Crypto.Tabs.map(t => ({
    ...t,
    isSelected: props.selected === t.tab,
    key: t.tab,
  }))

  const renderItem = (_: number, row: Row) => {
    return (
      <NavRow
        key={row.tab}
        isSelected={row.isSelected}
        title={row.title}
        tab={row.tab}
        icon={row.icon}
        onClick={() => props.onClick(row.tab)}
      />
    )
  }

  return (
    <Kb.Box2 direction="vertical" fullHeight={true} noShrink={true} style={styles.listContainer} testID={TestIDs.CRYPTO_INPUT}>
      <Kb.BoxGrow>
        <Kb.List
          items={rows}
          renderItem={renderItem}
          keyProperty="key"
          extraData={props.selected}
          style={styles.list}
          itemHeight={{sizeType: 'Small', type: 'fixedListItemAuto'}}
        />
      </Kb.BoxGrow>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  list: {
    ...Kb.Styles.globalStyles.fullHeight,
  },
  listContainer: {
    backgroundColor: Kb.Styles.globalColors.blueGrey,
    flexGrow: 0,
    width: 180,
  },
}))

export default LeftNav
