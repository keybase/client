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

export function List<T>(p: ListProps<T>) {
  const {items, ItemRenderer, loading, keyExtractor, onSelected, rowHeight} = p
  const {suggestBotCommandsUpdateStatus, listStyle, spinnerStyle, setOnMoveRef, setOnSubmitRef} = p
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  const renderItem = (idx: number, item: T) => (
    <Kb.ClickableBox direction="vertical" fullWidth={true} key={keyExtractor(item, idx)} onClick={() => onSelected(item, true)}>
      <ItemRenderer selected={idx === selectedIndex} item={item} />
    </Kb.ClickableBox>
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
