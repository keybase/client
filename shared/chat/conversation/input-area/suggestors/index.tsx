import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {useMemo} from '../../../../util/memoize'
import * as Container from '../../../../util/container'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import SuggestionList from './suggestion-list'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import type {Props} from '../normal/platform-input'
import {type EmojiData} from '../../../../util/emoji'

type TransformerData = {
  text: string
  position: {
    start: number | null
    end: number | null
  }
}

const standardTransformer = (
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

const matchesMarker = (
  word: string,
  marker: string | RegExp
): {
  marker: string
  matches: boolean
} => {
  if (typeof marker === 'string') {
    return {marker, matches: word.startsWith(marker)}
  }
  const match = word.match(marker)
  if (!match) {
    return {marker: '', matches: false}
  }
  return {marker: match[0] || '', matches: true}
}

const emojiTransformer = (emoji: EmojiData, marker: string, tData: TransformerData, preview: boolean) => {
  return standardTransformer(`${marker}${emoji.short_name}:`, tData, preview)
}

const transformChannelSuggestion = (
  {channelname, teamname}: {channelname: string; teamname?: string},
  marker: string,
  tData: TransformerData,
  preview: boolean
) =>
  standardTransformer(
    teamname ? `@${teamname}${marker}${channelname}` : `${marker}${channelname}`,
    tData,
    preview
  )

const transformUserSuggestion = (
  input: {
    fullName: string
    username: string
    teamname?: string
    channelname?: string
  },
  marker: string,
  tData: TransformerData,
  preview: boolean
) => {
  let s: string
  if (input.teamname) {
    if (input.channelname) {
      s = input.teamname + '#' + input.channelname
    } else {
      s = input.teamname
    }
  } else {
    s = input.username
  }
  return standardTransformer(`${marker}${s}`, tData, preview)
}

const getCommandPrefix = (command: RPCChatTypes.ConversationCommand) => {
  return command.username ? '!' : '/'
}

const transformCommandSuggestion = (
  command: RPCChatTypes.ConversationCommand,
  _: unknown,
  tData: TransformerData,
  preview: boolean
) => {
  const prefix = getCommandPrefix(command)
  return standardTransformer(`${prefix}${command.name}`, tData, preview)
}
const transformers = {
  channels: transformChannelSuggestion,
  commands: transformCommandSuggestion,
  emoji: emojiTransformer,
  users: transformUserSuggestion,
} as const

const suggestorToMarker = {
  channels: '#',
  commands: /(!|\/)/,
  emoji: /^(\+?):/,
  // 'users' is for @user, @team, and @team#channel
  users: /((\+\d+(\.\d+)?[a-zA-Z]{3,12}@)|@)/, // match normal mentions and ones in a stellar send
} as const

const keyExtractors = {
  channels: ({channelname, teamname}: {channelname: string; teamname?: string}) =>
    teamname ? `${teamname}#${channelname}` : channelname,
  commands: (c: RPCChatTypes.ConversationCommand) => c.name + c.username,
  emoji: (item: EmojiData) => item.short_name,
  users: ({username, teamname, channelname}: {username: string; teamname?: string; channelname?: string}) => {
    if (teamname) {
      if (channelname) {
        return teamname + '#' + channelname
      } else {
        return teamname
      }
    } else {
      return username
    }
  },
}

type UseSuggestorsProps = Pick<
  Props,
  | 'dataSources'
  | 'onBlur'
  | 'onChangeText'
  | 'onFocus'
  | 'onKeyDown'
  | 'onSelectionChange'
  | 'renderers'
  | 'suggestBotCommandsUpdateStatus'
  | 'suggestionOverlayStyle'
  | 'userEmojisLoading'
  | 'conversationIDKey'
> & {
  suggestionListStyle: unknown
  suggestionSpinnerStyle: unknown
}
export const useSuggestors = (p: UseSuggestorsProps) => {
  const {dataSources, renderers, suggestionListStyle, suggestionOverlayStyle} = p
  const {onBlur, userEmojisLoading, onFocus, onSelectionChange, onChangeText, onKeyDown} = p
  const {suggestBotCommandsUpdateStatus, suggestionSpinnerStyle, conversationIDKey} = p

  const [active, setActive] = React.useState('')
  const [expanded, setExpanded] = React.useState(false)
  const [filter, setFilter] = React.useState('')
  const [selected, setSelected] = React.useState(0)
  const inputRef = React.useRef<Kb.PlainInput | null>(null)
  const lastText = React.useRef('')
  const triggerIDRef = React.useRef<any>(0)

  const setInactive = React.useCallback(() => {
    setActive('')
    setFilter('')
    setSelected(0)
  }, [setActive, setFilter, setSelected])

  const results = useMemo(() => {
    return active ? dataSources[active](filter) : {data: [], loading: false, useSpaces: false}
  }, [active, dataSources, filter, userEmojisLoading])
  // userEmojisLoading is an implicit dep which should change

  const getSelected = React.useCallback(
    () => (active ? results.data[selected] : null),
    [active, results, selected]
  )

  const validateProps = React.useCallback(() => {
    if (!active) {
      return
    }
    if (!dataSources[active] || !renderers[active] || !suggestorToMarker[active] || !transformers[active]) {
      throw new Error(`AddSuggestors: invalid props for suggestor '${active}', did you miss a key somewhere?`)
    }
  }, [active, dataSources, renderers, suggestorToMarker, transformers])

  const onBlur2 = React.useCallback(() => {
    onBlur?.()
    setInactive()
  }, [onBlur, setInactive])

  const getWordAtCursor = React.useCallback(() => {
    if (inputRef.current) {
      const {useSpaces} = results
      const input = inputRef.current
      const selection = input.getSelection()
      const text = lastText.current
      if (!selection || selection.start === null || text === undefined) {
        return null
      }
      const upToCursor = text.substring(0, selection.start)
      let wordRegex: string | RegExp

      // If the datasource has data which contains spaces, we can't just split by a space character.
      // So if we need to, we instead split on the next space which precedes another special marker
      if (useSpaces) {
        const markers = Object.values(suggestorToMarker).map(p => (p instanceof RegExp ? p.source : p))
        wordRegex = new RegExp(` (?=${markers.join('|')})`, 'g')
      } else {
        wordRegex = / |\n/
      }
      const words = upToCursor.split(wordRegex)
      const word = words[words.length - 1]
      const position = {end: selection.start, start: selection.start - word.length}
      return {position, word}
    }
    return null
  }, [inputRef, results, suggestorToMarker])

  const triggerTransform = React.useCallback(
    (value: any, final = true) => {
      if (inputRef?.current && active) {
        const input = inputRef.current
        const cursorInfo = getWordAtCursor()
        if (!cursorInfo) {
          return
        }
        const matchInfo = matchesMarker(cursorInfo.word, suggestorToMarker[active])
        const transformedText = transformers[active](
          value,
          matchInfo.marker,
          {
            position: cursorInfo.position,
            text: lastText.current || '',
          },
          !final
        )
        lastText.current = transformedText.text
        input.transformText(() => transformedText, final)
      }
    },
    [active, inputRef, getWordAtCursor, transformers, suggestorToMarker, lastText]
  )

  const move = React.useCallback(
    (up: boolean) => {
      if (!active) {
        return
      }
      const length = results.data.length
      const s = (((up ? selected - 1 : selected + 1) % length) + length) % length
      if (s !== selected) {
        setSelected(s)
        const val = active ? results.data[s] : null
        triggerTransform(val, false)
      }
    },
    [active, results, selected, setSelected, triggerTransform]
  )

  const checkTrigger = React.useCallback(() => {
    if (triggerIDRef.current) {
      clearTimeout(triggerIDRef.current)
    }
    triggerIDRef.current = setTimeout(() => {
      // inside a timeout so selection will settle, there was a problem where
      // desktop would get the previous selection on arrowleft / arrowright
      const cursorInfo = getWordAtCursor()
      if (!cursorInfo) {
        return
      }
      const {word} = cursorInfo

      if (active) {
        const activeMarker = suggestorToMarker[active]
        const matchInfo = matchesMarker(word, activeMarker)
        if (!matchInfo.matches) {
          // not active anymore
          setInactive()
        } else {
          setFilter(word.substring(matchInfo.marker.length))

          // call this._stabilizeSelection?
          return
        }
      }
      // @ts-ignore we know entries will give this type
      for (let [suggestor, marker]: [string, string | RegExp] of Object.entries(suggestorToMarker)) {
        const matchInfo = matchesMarker(word, marker as any)
        if (matchInfo.matches && inputRef.current?.isFocused()) {
          setActive(suggestor)
          setFilter(word.substring(matchInfo.marker.length))
        }
      }
    }, 1)
  }, [getWordAtCursor, triggerIDRef, setActive, setFilter, suggestorToMarker, setInactive, active, inputRef])

  const onChangeText2 = React.useCallback(
    (text: string) => {
      lastText.current = text
      onChangeText?.(text)
      checkTrigger()
    },
    [lastText, onChangeText, checkTrigger]
  )

  const onKeyDown2 = React.useCallback(
    (evt: React.KeyboardEvent) => {
      if (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') {
        checkTrigger()
      }

      if (!active || results.data.length === 0) {
        // not showing list, bail
        onKeyDown?.(evt)
        return
      }

      let shouldCallParentCallback = true

      // check trigger keys (up, down, enter, tab)
      if (evt.key === 'ArrowDown') {
        evt.preventDefault()
        move(false)
        shouldCallParentCallback = false
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault()
        move(true)
        shouldCallParentCallback = false
      } else if (evt.key === 'Enter') {
        evt.preventDefault()
        triggerTransform(results.data[selected])
        shouldCallParentCallback = false
      } else if (evt.key === 'Tab') {
        evt.preventDefault()
        if (filter.length) {
          triggerTransform(getSelected())
        } else {
          // shift held -> move up
          move(evt.shiftKey)
        }
        shouldCallParentCallback = false
      }

      if (shouldCallParentCallback) {
        onKeyDown?.(evt)
      }
    },
    [onKeyDown, active, checkTrigger, filter, results, selected, move, getSelected, triggerTransform]
  )

  const onFocus2 = React.useCallback(() => {
    onFocus?.()
    checkTrigger()
  }, [onFocus, checkTrigger])

  const onSelectionChange2 = React.useCallback(
    (selection: TransformerData['position']) => {
      onSelectionChange?.(selection)
      checkTrigger()
    },
    [onSelectionChange, checkTrigger]
  )

  const dispatch = Container.useDispatch()

  const onFetchEmoji = React.useCallback(() => {
    dispatch(Chat2Gen.createFetchUserEmoji({conversationIDKey}))
  }, [dispatch, conversationIDKey])

  const onChannelSuggestionsTriggered = React.useCallback(() => {
    dispatch(Chat2Gen.createChannelSuggestionsTriggered({conversationIDKey}))
  }, [dispatch, conversationIDKey])

  React.useEffect(() => {
    switch (active) {
      case 'channels':
        onChannelSuggestionsTriggered()
        break
      case 'emoji':
        onFetchEmoji()
        break
    }
  }, [active, onChannelSuggestionsTriggered, onFetchEmoji])

  React.useEffect(() => {
    return () => {
      clearTimeout(triggerIDRef.current)
    }
  }, [])

  if (active) {
    validateProps()
  }
  const suggestionsVisible: boolean =
    results.data.length ||
    results.loading ||
    suggestBotCommandsUpdateStatus !== RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank

  const popup = suggestionsVisible && (
    <Popup suggestionOverlayStyle={suggestionOverlayStyle} setInactive={setInactive} inputRef={inputRef}>
      <ListOrLoading
        active={active}
        expanded={expanded}
        keyExtractors={keyExtractors}
        results={results}
        selected={selected}
        suggestBotCommandsUpdateStatus={suggestBotCommandsUpdateStatus}
        suggestionListStyle={suggestionListStyle}
        suggestionSpinnerStyle={suggestionSpinnerStyle}
        setSelected={setSelected}
        triggerTransform={triggerTransform}
        renderers={renderers}
      />
    </Popup>
  )

  return {
    inputRef,
    onBlur: onBlur2,
    onChangeText: onChangeText2,
    onExpanded: setExpanded,
    onFocus: onFocus2,
    onKeyDown: onKeyDown2,
    onSelectionChange: onSelectionChange2,
    popup,
    suggestionsVisible,
  }
}

const ListOrLoading = (p: any) => {
  const {active, expanded, keyExtractors, results, selected, setSelected, renderers} = p
  const {suggestBotCommandsUpdateStatus, suggestionListStyle, suggestionSpinnerStyle, triggerTransform} = p

  const itemRenderer = React.useCallback(
    (index: number, value: string): React.ReactElement | null =>
      !active ? null : (
        <Kb.ClickableBox
          key={keyExtractors?.[active]?.(value) || value}
          onClick={() => triggerTransform(value)}
          onMouseMove={() => setSelected(index)}
        >
          {renderers[active](value, Styles.isMobile ? false : index === selected)}
        </Kb.ClickableBox>
      ),
    [active, keyExtractors, renderers, triggerTransform, setSelected, selected]
  )

  if (results.data.length) {
    return (
      <>
        <SuggestionList
          style={expanded ? {bottom: 95, position: 'absolute', top: 95} : suggestionListStyle}
          items={results.data}
          keyExtractor={(keyExtractors && !!active && keyExtractors[active]) || undefined}
          renderItem={itemRenderer}
          selectedIndex={selected}
          suggestBotCommandsUpdateStatus={suggestBotCommandsUpdateStatus}
        />
        {results.loading && (
          <Kb.ProgressIndicator type={Styles.isMobile ? undefined : 'Large'} style={suggestionSpinnerStyle} />
        )}
      </>
    )
  }
  return (
    <Kb.Box2
      direction="vertical"
      alignItems="center"
      fullWidth={true}
      style={Styles.collapseStyles([styles.spinnerBackground, suggestionListStyle])}
    >
      <Kb.ProgressIndicator type={Styles.isMobile ? undefined : 'Large'} />
    </Kb.Box2>
  )
}

const Popup = (p: any) => {
  const {children, suggestionOverlayStyle, setInactive, inputRef} = p
  const getAttachmentRef = React.useCallback(() => inputRef.current, [inputRef])

  return Styles.isMobile ? (
    <Kb.FloatingBox
      containerStyle={suggestionOverlayStyle}
      dest="keyboard-avoiding-root"
      onHidden={setInactive}
    >
      {children}
    </Kb.FloatingBox>
  ) : (
    <Kb.Overlay
      attachTo={getAttachmentRef}
      matchDimension={true}
      position="top center"
      positionFallbacks={['bottom center']}
      visible={true}
      propagateOutsideClicks={false}
      onHidden={setInactive}
      style={suggestionOverlayStyle}
    >
      {children}
    </Kb.Overlay>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  commandStatusContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      justifyContent: 'center',
    },
    isElectron: {
      bottom: 0,
      height: 22,
      position: 'absolute',
    },
    isMobile: {},
  }),
  spinnerBackground: Styles.platformStyles({
    common: {justifyContent: 'center'},
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      borderRadius: 4,
      height: Styles.globalMargins.large,
    },
    isMobile: {
      flexGrow: 0,
      height: Styles.globalMargins.mediumLarge,
      marginTop: 'auto',
    },
  }),
}))
