import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import SuggestionList from './suggestion-list'

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

export type ListProps<T> = {
  expanded: boolean
  items: Array<T>
  itemRenderer: (index: number, item: T) => React.ReactNode
  keyExtractor: (item: T) => string
  suggestBotCommandsUpdateStatus?: RPCChatTypes.UIBotCommandsUpdateStatusTyp
  listStyle: any
  spinnerStyle: any
  loading: boolean
  selectedIndex: number
}

export function List<T>(p: ListProps<T>) {
  const {expanded, items, selectedIndex, itemRenderer, loading, keyExtractor} = p
  const {suggestBotCommandsUpdateStatus, listStyle, spinnerStyle} = p

  // const itemRenderer = React.useCallback(
  //   (index: number, value: any): React.ReactElement | null => {
  //     const s = Styles.isMobile ? false : index === selected
  //     let content: React.ReactNode = null
  //     let key = ''
  //     switch (active) {
  //       case 'channels':
  //         content = <Channels.Renderer value={value} selected={s} />
  //         key = Channels.keyExtractor(value)
  //         break
  //       case 'commands':
  //         content = <Commands.Renderer value={value} selected={s} />
  //         key = Commands.keyExtractor(value)
  //         break
  //       case 'emoji':
  //         content = <Emoji.Renderer value={value} selected={s} />
  //         key = Emoji.keyExtractor(value)
  //         break
  //       case 'users':
  //         content = <Users.Renderer value={value} selected={s} />
  //         key = Users.keyExtractor(value)
  //         break
  //     }
  //     return !content ? null : (
  //       <Kb.ClickableBox
  //         key={key}
  //         onClick={() => triggerTransform(value)}
  //         onMouseMove={() => setSelected(index)}
  //       >
  //         {content}
  //       </Kb.ClickableBox>
  //     )
  //   },
  //   [active, triggerTransform, setSelected, selected]
  // )

  return (
    <>
      <SuggestionList
        style={expanded ? {bottom: 95, position: 'absolute', top: 95} : listStyle}
        items={items}
        keyExtractor={keyExtractor}
        renderItem={itemRenderer}
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
