import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {useMemo} from '../../../../util/memoize'
import * as Container from '../../../../util/container'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import SuggestionList from './suggestion-list'
import type {Props} from '../normal/platform-input'
import * as Channels from './channels'
import * as Commands from './commands'
import * as Emoji from './emoji'
import * as Users from './users'
import type * as Common from './common'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

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

const transformers = {
  channels: Channels.transformer,
  commands: Commands.transformer,
  emoji: Emoji.transformer,
  users: Users.transformer,
} as const

const suggestorToMarker = {
  channels: '#',
  commands: /(!|\/)/,
  emoji: /^(\+?):/,
  // 'users' is for @user, @team, and @team#channel
  users: /((\+\d+(\.\d+)?[a-zA-Z]{3,12}@)|@)/, // match normal mentions and ones in a stellar send
} as const

type UseSuggestorsProps = Pick<
  Props,
  | 'onBlur'
  | 'onChangeText'
  | 'onFocus'
  | 'onKeyDown'
  | 'onSelectionChange'
  | 'suggestBotCommandsUpdateStatus'
  | 'suggestionOverlayStyle'
  | 'conversationIDKey'
> & {
  suggestionListStyle: unknown
  suggestionSpinnerStyle: unknown
}

type ActiveType = '' | 'channels' | 'commands' | 'emoji' | 'users'

// TODO change this, use sep components
const useDataSources = (
  active: ActiveType,
  conversationIDKey: UseSuggestorsProps['conversationIDKey'],
  filter: string
) => {
  const channels = Channels.useDataSource(active, conversationIDKey, filter)
  const commands = Commands.useDataSource(active, conversationIDKey, filter)
  const emoji = Emoji.useDataSource(active, conversationIDKey, filter)
  const users = Users.useDataSource(active, conversationIDKey, filter)
  const noData = useMemo(() => ({data: [], loading: false, useSpaces: false}), [])
  return channels || commands || emoji || users || noData
}

export const useSuggestors = (p: UseSuggestorsProps) => {
  const {suggestionListStyle, suggestionOverlayStyle} = p
  const {onBlur, onFocus, onSelectionChange, onChangeText, onKeyDown} = p
  const {suggestBotCommandsUpdateStatus, suggestionSpinnerStyle, conversationIDKey} = p

  const [active, setActive] = React.useState<ActiveType>('')
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

  const results = useDataSources(active, conversationIDKey, filter)

  const getSelected = React.useCallback(
    () => (active ? results.data[selected] : null),
    [active, results, selected]
  )

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
  }, [inputRef, results])

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
    [active, inputRef, getWordAtCursor, lastText]
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
          setActive(suggestor as ActiveType)
          setFilter(word.substring(matchInfo.marker.length))
        }
      }
    }, 1)
  }, [getWordAtCursor, triggerIDRef, setActive, setFilter, setInactive, active, inputRef])

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
    (selection: Common.TransformerData['position']) => {
      onSelectionChange?.(selection)
      checkTrigger()
    },
    [onSelectionChange, checkTrigger]
  )

  const dispatch = Container.useDispatch()

  // TODO move
  const onFetchEmoji = React.useCallback(() => {
    dispatch(Chat2Gen.createFetchUserEmoji({conversationIDKey}))
  }, [dispatch, conversationIDKey])

  // TODO move
  const onChannelSuggestionsTriggered = React.useCallback(() => {
    dispatch(Chat2Gen.createChannelSuggestionsTriggered({conversationIDKey}))
  }, [dispatch, conversationIDKey])

  // TODO move
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

  const suggestionsVisible: boolean =
    results.data.length ||
    results.loading ||
    suggestBotCommandsUpdateStatus !== RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank

  const content = results.data.length ? (
    <List
      active={active}
      expanded={expanded}
      results={results}
      selected={selected}
      suggestBotCommandsUpdateStatus={suggestBotCommandsUpdateStatus}
      suggestionListStyle={suggestionListStyle}
      suggestionSpinnerStyle={suggestionSpinnerStyle}
      setSelected={setSelected}
      triggerTransform={triggerTransform}
    />
  ) : (
    <Kb.Box2
      direction="vertical"
      alignItems="center"
      fullWidth={true}
      style={Styles.collapseStyles([styles.spinnerBackground, suggestionListStyle])}
    >
      <Kb.ProgressIndicator type={Styles.isMobile ? undefined : 'Large'} />
    </Kb.Box2>
  )

  const popup = suggestionsVisible && (
    <Popup suggestionOverlayStyle={suggestionOverlayStyle} setInactive={setInactive} inputRef={inputRef}>
      {content}
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

const List = (p: any) => {
  const {active, expanded, results, selected, setSelected} = p
  const {suggestBotCommandsUpdateStatus, suggestionListStyle, suggestionSpinnerStyle, triggerTransform} = p

  const itemRenderer = React.useCallback(
    (index: number, value: any): React.ReactElement | null => {
      const s = Styles.isMobile ? false : index === selected
      let content: React.ReactNode = null
      let key = ''
      switch (active) {
        case 'channels':
          content = <Channels.Renderer value={value} selected={s} />
          key = Channels.keyExtractor(value)
          break
        case 'commands':
          content = <Commands.Renderer value={value} selected={s} />
          key = Commands.keyExtractor(value)
          break
        case 'emoji':
          content = <Emoji.Renderer value={value} selected={s} />
          key = Emoji.keyExtractor(value)
          break
        case 'users':
          content = <Users.Renderer value={value} selected={s} />
          key = Users.keyExtractor(value)
          break
      }
      return !content ? null : (
        <Kb.ClickableBox
          key={key}
          onClick={() => triggerTransform(value)}
          onMouseMove={() => setSelected(index)}
        >
          {content}
        </Kb.ClickableBox>
      )
    },
    [active, triggerTransform, setSelected, selected]
  )

  return (
    <>
      <SuggestionList
        style={expanded ? {bottom: 95, position: 'absolute', top: 95} : suggestionListStyle}
        items={results.data}
        keyExtractor={undefined /* TODO */}
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
