import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import SuggestionList from './suggestion-list'
import type * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import type * as Types from '../../../../constants/types/chat2'

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
    style={Styles.collapseStyles([
      styles.suggestionBase,
      styles.fixSuggestionHeight,
      {
        backgroundColor: p.selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white,
      },
    ])}
    gap="tiny"
  >
    <Kb.Avatar teamname={p.teamname} size={32} />
    <Kb.Text type="BodyBold">{p.channelname ? p.teamname + ' #' + p.channelname : p.teamname}</Kb.Text>
  </Kb.Box2>
)

export type ItemRendererProps<T> = {selected: boolean; item: T; conversationIDKey: Types.ConversationIDKey}
export type ListProps<T> = {
  expanded: boolean
  items: Array<T>
  keyExtractor: (item: T, idx: number) => string
  suggestBotCommandsUpdateStatus?: RPCChatTypes.UIBotCommandsUpdateStatusTyp
  listStyle: Styles.StylesCrossPlatform
  spinnerStyle: Styles.StylesCrossPlatform
  loading: boolean
  onSelected: (item: T, final: boolean) => void
  onMoveRef: React.MutableRefObject<((up: boolean) => void) | undefined>
  onSubmitRef: React.MutableRefObject<(() => boolean) | undefined>
  ItemRenderer: (p: ItemRendererProps<T>) => JSX.Element
  conversationIDKey: Types.ConversationIDKey
}

export function List<T>(p: ListProps<T>) {
  const {expanded, items, ItemRenderer, loading, keyExtractor, onSelected, conversationIDKey} = p
  const {suggestBotCommandsUpdateStatus, listStyle, spinnerStyle, onMoveRef, onSubmitRef} = p
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  const renderItem = React.useCallback(
    (idx, item: T) => (
      <Kb.ClickableBox key={keyExtractor(item, idx)} onClick={() => onSelected(item, true)}>
        <ItemRenderer selected={idx === selectedIndex} item={item} conversationIDKey={conversationIDKey} />
      </Kb.ClickableBox>
    ),
    [selectedIndex, onSelected, ItemRenderer, keyExtractor, conversationIDKey]
  )

  Container.useDepChangeEffect(() => {
    const sel = items[selectedIndex]
    sel && onSelected(sel, false)
  }, [selectedIndex])

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
      {loading && <Kb.ProgressIndicator type={Styles.isMobile ? undefined : 'Large'} style={spinnerStyle} />}
    </>
  )
}

export const styles = Styles.styleSheetCreate(() => ({
  fixSuggestionHeight: Styles.platformStyles({
    isMobile: {height: 48},
  }),
  suggestionBase: {
    alignItems: 'center',
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
}))
