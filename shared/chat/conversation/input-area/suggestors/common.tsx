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
    <Kb.Avatar teamname={p.teamname} size={32} />
    <Kb.Text type="BodyBold">{p.channelname ? p.teamname + ' #' + p.channelname : p.teamname}</Kb.Text>
  </Kb.Box2>
)

export type ItemRendererProps<T> = {selected: boolean; item: T}
export type ListProps<L> = {
  expanded: boolean
  items: Array<L>
  keyExtractor: (item: L, idx: number) => string
  suggestBotCommandsUpdateStatus?: T.RPCChat.UIBotCommandsUpdateStatusTyp
  listStyle: Kb.Styles.StylesCrossPlatform
  spinnerStyle: Kb.Styles.StylesCrossPlatform
  loading: boolean
  onSelected: (item: L, final: boolean) => void
  onMoveRef: React.MutableRefObject<((up: boolean) => void) | undefined>
  onSubmitRef: React.MutableRefObject<(() => boolean) | undefined>
  ItemRenderer: (p: ItemRendererProps<L>) => React.JSX.Element
}

export function List<T>(p: ListProps<T>) {
  const {expanded, items, ItemRenderer, loading, keyExtractor, onSelected} = p
  const {suggestBotCommandsUpdateStatus, listStyle, spinnerStyle, onMoveRef, onSubmitRef} = p
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  const renderItem = React.useCallback(
    (idx: number, item: T) => (
      <Kb.ClickableBox key={keyExtractor(item, idx)} onClick={() => onSelected(item, true)}>
        <ItemRenderer selected={idx === selectedIndex} item={item} />
      </Kb.ClickableBox>
    ),
    [selectedIndex, onSelected, ItemRenderer, keyExtractor]
  )

  const lastSelectedIndex = React.useRef(selectedIndex)
  if (lastSelectedIndex.current !== selectedIndex) {
    lastSelectedIndex.current = selectedIndex
    const sel = items[selectedIndex]
    if (sel) {
      onSelected(sel, false)
    }
  }

  onMoveRef.current = React.useCallback(
    (up: boolean) => {
      const length = items.length
      const s = (((up ? selectedIndex - 1 : selectedIndex + 1) % length) + length) % length
      if (s !== selectedIndex) {
        setSelectedIndex(s)
      }
    },
    [setSelectedIndex, items, selectedIndex]
  )

  onSubmitRef.current = React.useCallback(() => {
    const sel = items[selectedIndex]
    sel && onSelected(sel, true)
    return !!sel
  }, [selectedIndex, onSelected, items])

  return (
    <>
      <SuggestionList
        style={expanded ? {bottom: 95, position: 'absolute', top: 95} : listStyle}
        items={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        selectedIndex={selectedIndex}
        suggestBotCommandsUpdateStatus={suggestBotCommandsUpdateStatus}
      />
      {loading && (
        <Kb.ProgressIndicator type={Kb.Styles.isMobile ? undefined : 'Large'} style={spinnerStyle} />
      )}
    </>
  )
}

export const styles = Kb.Styles.styleSheetCreate(() => ({
  fixSuggestionHeight: Kb.Styles.platformStyles({
    isMobile: {height: 48},
  }),
  suggestionBase: {
    alignItems: 'center',
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingLeft: Kb.Styles.globalMargins.tiny,
    paddingRight: Kb.Styles.globalMargins.tiny,
    paddingTop: Kb.Styles.globalMargins.xtiny,
  },
}))
