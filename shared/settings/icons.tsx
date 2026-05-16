// Dev-only icon browser. Gated by __DEV__ in nav and routes — never visible in production.
import * as Kb from '@/common-adapters'
import {iconMeta} from '@/common-adapters/icon.constants-gen'
import type {IconType} from '@/common-adapters/icon.constants-gen'
import * as React from 'react'

const iconfontTypes: ReadonlyArray<IconType> = (Object.keys(iconMeta) as Array<IconType>)
  .filter(k => k.startsWith('iconfont-'))
  .sort()

const CELL_SIZE = 80

const IconCell = ({type}: {type: IconType}) => {
  const name = type.replace(/^iconfont-/, '')
  return (
    <Kb.Box2 direction="vertical" style={styles.cell} alignItems="center">
      <Kb.Icon type={type} sizeType="Big" />
      <Kb.Text type="BodyTiny" style={styles.cellLabel} lineClamp={2}>
        {name}
      </Kb.Text>
    </Kb.Box2>
  )
}

const Icons = () => {
  const [query, setQuery] = React.useState('')
  const filtered = query
    ? iconfontTypes.filter(t => t.includes(query.toLowerCase()))
    : iconfontTypes

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchRow} alignItems="center">
        <Kb.SearchFilter
          onChange={setQuery}
          placeholderText="Filter icons…"
          size="full-width"
          value={query}
          valueControlled={true}
        />
        <Kb.Text type="BodySmall" style={styles.count}>
          {filtered.length} / {iconfontTypes.length}
        </Kb.Text>
      </Kb.Box2>
      <Kb.ScrollView style={styles.scroll}>
        <Kb.Box2 direction="horizontal" style={styles.grid}>
          {filtered.map(t => (
            <IconCell key={t} type={t} />
          ))}
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  cell: {
    height: CELL_SIZE,
    padding: Kb.Styles.globalMargins.xtiny,
    width: CELL_SIZE,
  },
  cellLabel: {
    color: Kb.Styles.globalColors.black_50,
    marginTop: 2,
    textAlign: 'center',
  },
  count: {
    color: Kb.Styles.globalColors.black_50,
    marginLeft: Kb.Styles.globalMargins.small,
  },
  grid: {
    flexWrap: 'wrap',
    padding: Kb.Styles.globalMargins.tiny,
  },
  scroll: {flex: 1},
  searchRow: {
    borderBottomColor: Kb.Styles.globalColors.black_10,
    borderBottomWidth: 1,
    padding: Kb.Styles.globalMargins.small,
  },
}))

export default Icons
