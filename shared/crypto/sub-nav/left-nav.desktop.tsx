import * as React from 'react'
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
  children?: React.ReactNode
}

const SubNav = (props: Props) => {
  React.useEffect(() => { console.log('E2E: Crypto screen mounted') }, [])
  const getRows = () =>
    Crypto.Tabs.map(t => ({
      ...t,
      isSelected: props.selected === t.tab,
      key: t.tab,
    }))

  const _onClick = (tab: string) => {
    props.onClick(tab)
  }

  const renderItem = (_: number, row: Row) => {
    return (
      <NavRow
        key={row.tab}
        isSelected={row.isSelected}
        title={row.title}
        tab={row.tab}
        icon={row.icon}
        onClick={() => _onClick(row.tab)}
      />
    )
  }

  return (
    <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} testID={TestIDs.CRYPTO_INPUT}>
      <Kb.Box2 direction="vertical" fullHeight={true} style={styles.listContainer}>
        <Kb.BoxGrow>
          <Kb.List
            items={getRows()}
            renderItem={renderItem}
            keyProperty="key"
            extraData={props.selected}
            style={styles.list}
            itemHeight={{sizeType: 'Small', type: 'fixedListItemAuto'}}
          />
        </Kb.BoxGrow>
      </Kb.Box2>
      {props.children}
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
    flexShrink: 0,
    width: 180,
  },
}))

export default SubNav
