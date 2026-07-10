// Dev-only icon browser. Gated by __DEV__ in nav and routes — never visible in production.
import * as Kb from '@/common-adapters'
import {iconMeta} from '@/common-adapters/icon.constants-gen.shared'
import type {IconType} from '@/common-adapters/icon.constants-gen.d'
import * as React from 'react'
// The non-iOS module throws when rendered, so every usage is gated on isIOS.
import {SFSymbol as NavSFSymbol} from '@react-navigation/native'
import type {SFSymbol as SFSymbolName} from 'sf-symbols-typescript'

const iconfontTypes: ReadonlyArray<IconType> = (Object.keys(iconMeta) as Array<IconType>)
  .filter(k => k.startsWith('iconfont-'))
  .sort()

const CELL_SIZE = 80

const IconCell = ({type}: {type: IconType}) => {
  const name = type.replace(/^iconfont-/, '')
  return (
    <Kb.Box2 direction="vertical" padding="xtiny" style={styles.cell} alignItems="center">
      <Kb.Icon type={type} sizeType="Big" />
      <Kb.Text type="BodyTiny" style={styles.cellLabel} lineClamp={2}>
        {name}
      </Kb.Text>
    </Kb.Box2>
  )
}

const sfTogglePairs: ReadonlyArray<{off: SFSymbolName; on: SFSymbolName}> = [
  {off: 'bell', on: 'bell.slash'},
  {off: 'play.fill', on: 'pause.fill'},
  {off: 'mic', on: 'mic.slash'},
  {off: 'lock', on: 'lock.open'},
]

const SFToggleCell = ({off, on}: {off: SFSymbolName; on: SFSymbolName}) => {
  const [isOn, setOn] = React.useState(false)
  const name = isOn ? on : off
  return (
    <Kb.ClickableBox
      onClick={() => setOn(s => !s)}
      direction="vertical"
      padding="xtiny"
      style={styles.cell}
      alignItems="center"
    >
      <NavSFSymbol
        name={name}
        size={32}
        color={Kb.Styles.globalColors.black}
        contentTransition={{magic: true, type: 'replace'}}
      />
      <Kb.Text type="BodyTiny" style={styles.cellLabel} lineClamp={2}>
        {name}
      </Kb.Text>
    </Kb.ClickableBox>
  )
}

const SFVariableCell = () => {
  const [value, setValue] = React.useState(1)
  return (
    <Kb.ClickableBox
      onClick={() => setValue(v => (v >= 1 ? 0 : Math.min(1, v + 0.34)))}
      direction="vertical"
      padding="xtiny"
      style={styles.cell}
      alignItems="center"
    >
      <NavSFSymbol
        name="wifi"
        size={32}
        color={Kb.Styles.globalColors.black}
        variableValue={value}
        contentTransition="automatic"
      />
      <Kb.Text type="BodyTiny" style={styles.cellLabel} lineClamp={2}>
        wifi {Math.round(value * 100)}%
      </Kb.Text>
    </Kb.ClickableBox>
  )
}

const SFSymbolDemos = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} padding="tiny" alignItems="flex-start">
    <Kb.Text type="BodySmallSemibold">SF Symbol contentTransition — tap a tile (iOS 17+)</Kb.Text>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.grid}>
      {sfTogglePairs.map(p => (
        <SFToggleCell key={p.off} off={p.off} on={p.on} />
      ))}
      <SFVariableCell />
    </Kb.Box2>
  </Kb.Box2>
)

const Icons = () => {
  const [query, setQuery] = React.useState('')
  const filtered = query
    ? iconfontTypes.filter(t => t.includes(query.toLowerCase()))
    : iconfontTypes

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} padding="small" style={styles.searchRow} alignItems="center">
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
        {isIOS && !query && <SFSymbolDemos />}
        <Kb.Box2 direction="horizontal" padding="tiny" style={styles.grid}>
          {filtered.map(t => (
            <IconCell key={t} type={t} />
          ))}
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  cell: Kb.Styles.size(CELL_SIZE),
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
  },
  scroll: {flex: 1},
  searchRow: {
    borderBottomColor: Kb.Styles.globalColors.black_10,
    borderBottomWidth: 1,
  },
}))

export default Icons
