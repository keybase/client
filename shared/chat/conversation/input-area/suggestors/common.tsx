import * as Kb from '@/common-adapters'
import * as React from 'react'
import SuggestionList from './suggestion-list'
import type * as T from '@/constants/types'

export type TransformerData = {
  text: string
  position: {
    start: number | null
    end: number | null
  }
}

export const standardTransformer = (
  toInsert: string,
  {text, position: {start, end}}: TransformerData,
  preview: boolean
) => {
  const rest = text.substring(end || 0)
  // don't wedge a space in front of text that already reads on from the insertion:
  // existing whitespace, or punctuation that must stay tight against it
  const separator = preview || /^[\s\p{P}]/u.test(rest) ? '' : ' '
  const newText = `${text.substring(0, start || 0)}${toInsert}${separator}${rest}`
  const newSelection = (start || 0) + toInsert.length + separator.length
  return {selection: {end: newSelection, start: newSelection}, text: newText}
}

// rows have no explicit height on desktop, so each suggestor derives its row
// height from its tallest child plus the padding `suggestionBase` adds
export const desktopRowHeight = (contentHeight: number) => contentHeight + Kb.Styles.globalMargins.xtiny * 2
export const avatarSize = 32
// rows leading with an avatar (users, teams, channels-of-a-team)
export const avatarRowHeight = desktopRowHeight(avatarSize)

export const TeamSuggestion = (p: {teamname: string; channelname: string | undefined; selected: boolean}) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([
        styles.suggestionBase,
        styles.fixSuggestionHeight,
        {
          backgroundColor: p.selected ? theme.blueLighter2 : theme.white,
        },
      ])}
      gap="tiny"
    >
      <Kb.Avatar teamname={p.teamname} size={avatarSize} />
      <Kb.Text type="BodyBold">{p.channelname ? p.teamname + ' #' + p.channelname : p.teamname}</Kb.Text>
    </Kb.Box2>
  )
}

export type ItemRendererProps<T> = {selected: boolean; item: T}
// What a mounted list gives the composer's keys: one handle for as long as the list is open,
// whose methods read the list as it is when the key lands.
export type ListHandle = {
  hasItems: () => boolean
  move: (up: boolean) => void
  // true if it picked anything
  submit: () => boolean
}
export type ListProps<L> = {
  items: Array<L>
  keyExtractor: (item: L, idx: number) => string
  suggestBotCommandsUpdateStatus?: T.RPCChat.UIBotCommandsUpdateStatusTyp
  listStyle: Kb.Styles.StylesCrossPlatform
  spinnerStyle: Kb.Styles.StylesCrossPlatform
  loading: boolean
  // desktop only, see SuggestionList
  rowHeight: number
  onSelected: (item: L, final: boolean) => void
  setListHandle: (h: ListHandle | undefined) => void
  ItemRenderer: (p: ItemRendererProps<L>) => React.JSX.Element
}

type RowProps<T> = {
  ItemRenderer: (p: ItemRendererProps<T>) => React.JSX.Element
  item: T
  onSelected: (item: T, final: boolean) => void
  selected: boolean
}

const RowImpl = <T,>(p: RowProps<T>) => {
  const {ItemRenderer, item, onSelected, selected} = p
  return (
    <Kb.ClickableBox direction="vertical" fullWidth={true} onClick={() => onSelected(item, true)}>
      <ItemRenderer selected={selected} item={item} />
    </Kb.ClickableBox>
  )
}
// React.memo, not just compiler memo: the list calls renderItem outside the
// compiler's memo graph, so the shallow prop bail here is what lets unchanged
// rows skip on each filter keystroke
const Row = React.memo(RowImpl) as typeof RowImpl

export function List<T>(p: ListProps<T>) {
  const {items, ItemRenderer, loading, keyExtractor, onSelected, rowHeight} = p
  const {suggestBotCommandsUpdateStatus, listStyle, spinnerStyle, setListHandle} = p
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  // Any change to what the list holds (typing narrows or regrows it) starts the highlight again
  // from the first item, the way a desktop completion list does, so Enter and Tab pick that one.
  const itemsKey = items.map(keyExtractor).join('\n')
  const [lastItemsKey, setLastItemsKey] = React.useState(itemsKey)
  if (lastItemsKey !== itemsKey) {
    setLastItemsKey(itemsKey)
    setSelectedIndex(0)
  }

  const onSelectedEvent = React.useEffectEvent((item: T, final: boolean) => onSelected(item, final))
  const renderItem = (idx: number, item: T) => (
    <Row
      key={keyExtractor(item, idx)}
      ItemRenderer={ItemRenderer}
      item={item}
      onSelected={onSelectedEvent}
      selected={idx === selectedIndex}
    />
  )

  const hasItems = React.useEffectEvent(() => items.length > 0)
  // only a move previews, so a list that changes under the highlight never writes to the input
  const move = React.useEffectEvent((up: boolean) => {
    const length = items.length
    if (!length) return
    const s = (((up ? selectedIndex - 1 : selectedIndex + 1) % length) + length) % length
    const item = items[s]
    if (s === selectedIndex || !item) return
    setSelectedIndex(s)
    onSelected(item, false)
  })
  const submit = React.useEffectEvent(() => {
    const sel = items[selectedIndex]
    if (sel) {
      onSelected(sel, true)
    }
    return !!sel
  })
  const handOver = React.useEffectEvent((h: ListHandle | undefined) => {
    setListHandle(h)
  })
  React.useEffect(() => {
    handOver({hasItems: () => hasItems(), move: up => move(up), submit: () => submit()})
    return () => {
      handOver(undefined)
    }
  }, [])

  return (
    <>
      <SuggestionList
        style={listStyle}
        items={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        rowHeight={rowHeight}
        selectedIndex={selectedIndex}
        suggestBotCommandsUpdateStatus={suggestBotCommandsUpdateStatus}
      />
      {loading && (
        <Kb.ProgressIndicator type={isMobile ? undefined : 'Large'} style={spinnerStyle} />
      )}
    </>
  )
}

export const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      fixSuggestionHeight: Kb.Styles.platformStyles({
        isMobile: {height: 48},
      }),
      suggestionBase: {
        alignItems: 'center',
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xtiny, Kb.Styles.globalMargins.tiny),
      },
    }) as const
)
