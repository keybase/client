import type * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Crypto from '@/stores/crypto'
import NavRow from './nav-row'

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
    <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
      <Kb.Box2 direction="vertical" fullHeight={true} style={styles.listContainer}>
        <Kb.BoxGrow>
          <Kb.List items={getRows()} renderItem={renderItem} keyProperty="key" style={styles.list} />
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
    borderStyle: 'solid',
    flexGrow: 0,
    flexShrink: 0,
    width: 180,
  },
}))

export default SubNav
