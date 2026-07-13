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
  const newText = `${text.substring(0, start || 0)}${toInsert}${preview ? '' : ' '}${text.substring(
    end || 0
  )}`
  const newSelection = (start || 0) + toInsert.length + (preview ? 0 : 1)
  return {selection: {end: newSelection, start: newSelection}, text: newText}
}

// rows have no explicit height on desktop, so each suggestor derives its row
// height from its tallest child plus the padding `suggestionBase` adds
export const desktopRowHeight = (contentHeight: number) => contentHeight + Kb.Styles.globalMargins.xtiny * 2
export const avatarSize = 32
// rows leading with an avatar (users, teams, channels-of-a-team)
export const avatarRowHeight = desktopRowHeight(avatarSize)

export const TeamSuggestion = (p: {teamname: string; channelname: string | undefined; selected: boolean}) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    style={Kb.Styles.collapseStyles([
      styles.suggestionBase,
      styles.fixSuggestionHeight,
      {
        backgroundColor: p.selected ? Kb.Styles.globalColors.blueLighter2 : Kb.Styles.globalColors.white,
      },
    ])}
    gap="tiny"
  >
    <Kb.Avatar teamname={p.teamname} size={avatarSize} />
    <Kb.Text type="BodyBold">{p.channelname ? p.teamname + ' #' + p.channelname : p.teamname}</Kb.Text>
  </Kb.Box2>
)

export type ItemRendererProps<T> = {selected: boolean; item: T}
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
  setOnMoveRef: (r: (up: boolean) => void) => void
  setOnSubmitRef: (r: () => boolean) => void
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
  const {suggestBotCommandsUpdateStatus, listStyle, spinnerStyle, setOnMoveRef, setOnSubmitRef} = p
  const [selectedIndex, setSelectedIndex] = React.useState(0)

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

  const lastSelectedIndex = React.useRef(selectedIndex)
  const sel = items[selectedIndex]
  React.useEffect(() => {
    if (lastSelectedIndex.current !== selectedIndex) {
      lastSelectedIndex.current = selectedIndex
      if (sel) {
        onSelected(sel, false)
      }
    }
  }, [onSelected, sel, selectedIndex])

  React.useEffect(() => {
    const onMove = (up: boolean) => {
      const length = items.length
      const s = (((up ? selectedIndex - 1 : selectedIndex + 1) % length) + length) % length
      if (s !== selectedIndex) {
        setSelectedIndex(s)
      }
    }

    const onSubmit = () => {
      const sel = items[selectedIndex]
      if (sel) {
        onSelected(sel, true)
      }
      return !!sel
    }

    setOnMoveRef(onMove)
    setOnSubmitRef(onSubmit)
  }, [setOnMoveRef, setOnSubmitRef, items, selectedIndex, onSelected, setSelectedIndex])

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

export const styles = Kb.Styles.styleSheetCreate(
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
