import * as Channels from './channels'
import * as C from '@/constants'
import * as Commands from './commands'
import * as Emoji from './emoji'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Users from './users'
import type * as Common from './common'
import type {Props} from '../normal/platform-input'

const positionFallbacks = ['bottom center'] as const

type MatchesMarkerType = {
  marker: string
  matches: boolean
}
const matchesMarker = (word: string, marker: string | RegExp): MatchesMarkerType => {
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
  commands: /^(!|\/)/,
  emoji: /^(\+?):/,
  // 'users' is for @user, @team, and @team#channel
  users: /((\+\d+(\.\d+)?[a-zA-Z]{3,12}@)|@)/, // match normal mentions and ones in a stellar send
} as const

type UseSuggestorsProps = Pick<
  Props,
  'onChangeText' | 'suggestBotCommandsUpdateStatus' | 'suggestionOverlayStyle'
> & {
  suggestionListStyle: Kb.Styles.StylesCrossPlatform
  suggestionSpinnerStyle: Kb.Styles.StylesCrossPlatform
  expanded: boolean
  inputRef: React.MutableRefObject<Kb.PlainInput | null>
  onKeyDown?: (evt: React.KeyboardEvent) => void
}

// nasty to mix these types but keeping this for now
type ActiveType = '' | 'channels' | 'commands' | 'emoji' | 'users'
type SelectedType = Parameters<(typeof transformers)['channels' | 'commands' | 'emoji' | 'users']>[0]

// handles watching the input and seeing which suggestor we need to use
type UseSyncInputProps = {
  active: ActiveType
  inputRef: React.MutableRefObject<Kb.PlainInput | null>
  setActive: React.Dispatch<React.SetStateAction<ActiveType>>
  setFilter: React.Dispatch<React.SetStateAction<string>>
  selectedItemRef: React.MutableRefObject<undefined | SelectedType>
  lastTextRef: React.MutableRefObject<string>
}
const useSyncInput = (p: UseSyncInputProps) => {
  const {inputRef, active, setActive, setFilter, selectedItemRef, lastTextRef} = p
  const setInactive = React.useCallback(() => {
    setActive('')
    setFilter('')
  }, [setActive, setFilter])

  const getWordAtCursor = React.useCallback(() => {
    if (inputRef.current) {
      const useSpaces = active === 'commands'
      const input = inputRef.current
      const selection = input.getSelection()
      const text = lastTextRef.current
      // eslint-disable-next-line
      if (!selection || selection.start === null) {
        return null
      }

      // move selection to end of the selected word so replacements don't squish with text after
      const startIdx = Math.min(selection.start, text.length)
      const nextSpaceIndex = text.indexOf(' ', startIdx)
      const toReplaceEnd = nextSpaceIndex !== -1 ? nextSpaceIndex : text.length

      const upToCursor = text.substring(0, toReplaceEnd)
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
      const lastWordPrefix = words.at(-1)
      const toReplaceStart = toReplaceEnd - (lastWordPrefix?.length ?? 0)
      const position = {end: toReplaceEnd, start: toReplaceStart}

      const word = text.substring(toReplaceStart, toReplaceEnd)
      return {position, word}
    }
    return null
  }, [inputRef, active, lastTextRef])

  const triggerIDRef = React.useRef<NodeJS.Timeout>()
  const checkTrigger = React.useCallback(() => {
    if (triggerIDRef.current) {
      clearTimeout(triggerIDRef.current)
    }
    triggerIDRef.current = setTimeout(() => {
      // inside a timeout so selection will settle, there was a problem where
      // desktop would get the previous selection on arrowleft / arrowright
      const cursorInfo = getWordAtCursor()
      if (!cursorInfo) {
        setInactive()
        return
      }
      const {word} = cursorInfo
      if (!word) {
        setInactive()
        return
      }
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
      const entries = Object.entries(suggestorToMarker) as Array<[string, string | RegExp]>
      for (const [suggestor, marker] of entries) {
        const matchInfo = matchesMarker(word, marker)
        if (matchInfo.matches && inputRef.current?.isFocused()) {
          setActive(suggestor as ActiveType)
          setFilter(word.substring(matchInfo.marker.length))
        }
      }
    }, 1)
  }, [getWordAtCursor, triggerIDRef, setActive, setFilter, setInactive, active, inputRef])

  React.useEffect(() => {
    return () => {
      clearTimeout(triggerIDRef.current)
    }
  }, [])

  const triggerTransform = React.useCallback(
    (maybeValue: SelectedType | undefined, final = true) => {
      if (!inputRef.current || !active) {
        return
      }
      const value = maybeValue ?? selectedItemRef.current
      if (!value) {
        return
      }
      const input = inputRef.current
      const cursorInfo = getWordAtCursor()
      const matchInfo = matchesMarker(cursorInfo?.word ?? '', suggestorToMarker[active])
      const transformedText = transformers[active](
        value as any,
        matchInfo.marker,
        {position: cursorInfo?.position ?? {end: null, start: null}, text: lastTextRef.current},
        !final
      )
      lastTextRef.current = transformedText.text
      input.transformText(() => transformedText, final)
    },
    [active, inputRef, getWordAtCursor, selectedItemRef, lastTextRef]
  )

  return {
    active,
    checkTrigger,
    setActive,
    setInactive,
    triggerTransform,
  }
}

type UseHandleKeyEventsProps = {
  onKeyDownProps?: (evt: React.KeyboardEvent) => void
  active: string
  checkTrigger: () => void
  filterEmpty: boolean
  onMoveRef: React.MutableRefObject<((up: boolean) => void) | undefined>
  onSubmitRef: React.MutableRefObject<(() => boolean) | undefined>
}
const useHandleKeyEvents = (p: UseHandleKeyEventsProps) => {
  const {onKeyDownProps, active, checkTrigger, filterEmpty, onMoveRef, onSubmitRef} = p

  const onKeyDown = React.useCallback(
    (evt: React.KeyboardEvent) => {
      if (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') {
        checkTrigger()
      }

      if (!active) {
        // not showing list, bail
        onKeyDownProps?.(evt)
        return
      }

      let shouldCallParentCallback = true
      // check trigger keys (up, down, enter, tab)
      switch (evt.key) {
        case 'ArrowDown':
          evt.preventDefault()
          onMoveRef.current?.(false)
          shouldCallParentCallback = false
          break
        case 'ArrowUp':
          evt.preventDefault()
          onMoveRef.current?.(true)
          shouldCallParentCallback = false
          break
        case 'Enter':
          if (!(evt.altKey || evt.shiftKey || evt.metaKey)) {
            evt.preventDefault()
            shouldCallParentCallback = !onSubmitRef.current?.()
          }
          break
        case 'Tab':
          evt.preventDefault()
          if (!filterEmpty) {
            onSubmitRef.current?.()
          } else {
            // shift held -> move up
            onMoveRef.current?.(evt.shiftKey)
          }
          shouldCallParentCallback = false
      }

      if (shouldCallParentCallback) {
        onKeyDownProps?.(evt)
      }
    },
    [onKeyDownProps, active, checkTrigger, filterEmpty, onMoveRef, onSubmitRef]
  )

  return {onKeyDown}
}

export const useSuggestors = (p: UseSuggestorsProps) => {
  const selectedItemRef = React.useRef<undefined | SelectedType>()
  const lastTextRef = React.useRef('')
  const [active, setActive] = React.useState<ActiveType>('')
  const [filter, setFilter] = React.useState('')
  const {inputRef, suggestionListStyle, suggestionOverlayStyle, expanded} = p
  const {onChangeText: onChangeTextProps} = p
  const {suggestBotCommandsUpdateStatus, suggestionSpinnerStyle} = p
  const {triggerTransform, checkTrigger, setInactive} = useSyncInput({
    active,
    inputRef,
    lastTextRef,
    selectedItemRef,
    setActive,
    setFilter,
  })

  // tell list to move the selection
  const onMoveRef = React.useRef<(up: boolean) => void>()
  // tell list we want to submit the selection, true if it selected anything
  const onSubmitRef = React.useRef<() => boolean>()

  const {onKeyDown} = useHandleKeyEvents({
    active,
    checkTrigger,
    filterEmpty: filter.length === 0,
    onKeyDownProps: p.onKeyDown,
    onMoveRef,
    onSubmitRef,
  })

  const onBlur = React.useCallback(() => {
    setInactive()
  }, [setInactive])

  const onChangeText = React.useCallback(
    (text: string) => {
      lastTextRef.current = text
      onChangeTextProps(text)
      checkTrigger()
    },
    [onChangeTextProps, checkTrigger]
  )

  const onFocus = React.useCallback(() => {
    checkTrigger()
  }, [checkTrigger])

  const onSelectionChange2 = React.useCallback(
    (_selection: Common.TransformerData['position']) => {
      checkTrigger()
    },
    [checkTrigger]
  )

  const onSelected = React.useCallback(
    (item: unknown, final: boolean) => {
      selectedItemRef.current = item as SelectedType
      triggerTransform(item as SelectedType, final)
    },
    [selectedItemRef, triggerTransform]
  )

  const listProps = {
    expanded,
    filter,
    listStyle: suggestionListStyle,
    onMoveRef,
    onSelected,
    onSubmitRef,
    spinnerStyle: suggestionSpinnerStyle,
    suggestBotCommandsUpdateStatus,
  }

  let content: React.ReactNode = null
  switch (active) {
    case 'channels':
      content = <Channels.List {...listProps} />
      break
    case 'commands':
      content = <Commands.List {...listProps} inputRef={inputRef} lastTextRef={lastTextRef} />
      break
    case 'emoji':
      content = <Emoji.List {...listProps} />
      break
    case 'users':
      content = <Users.UsersList {...listProps} />
      break
    default:
  }
  const popup = !!content && (
    <Popup suggestionOverlayStyle={suggestionOverlayStyle} setInactive={setInactive} inputRef={inputRef}>
      {content}
    </Popup>
  )

  return {
    inputRef,
    onBlur,
    onChangeText,
    onFocus,
    onKeyDown,
    onSelectionChange: onSelectionChange2,
    popup,
  }
}

type PopupProps = {
  suggestionOverlayStyle: Kb.Styles.StylesCrossPlatform
  setInactive: () => void
  inputRef: React.MutableRefObject<Kb.PlainInput | null>
  children: React.ReactNode
}
const Popup = (p: PopupProps) => {
  const {children, suggestionOverlayStyle, setInactive, inputRef} = p
  const conversationIdKey = C.useChatContext(s => s.id)

  const attachRef = React.useRef<Kb.MeasureRef | null>({
    divRef: {current: null},
    measure: () => {
      const c = inputRef.current?._input.current
      if (c) {
        return c.getBoundingClientRect?.()
      } else {
        return undefined
      }
    },
  })

  return Kb.Styles.isMobile ? (
    <Kb.FloatingBox containerStyle={suggestionOverlayStyle} onHidden={setInactive}>
      <C.ChatProvider id={conversationIdKey}>
        <Kb.KeyboardAvoidingView2>{children}</Kb.KeyboardAvoidingView2>
      </C.ChatProvider>
    </Kb.FloatingBox>
  ) : (
    <Kb.Overlay
      attachTo={attachRef}
      matchDimension={true}
      position="top center"
      positionFallbacks={positionFallbacks}
      visible={true}
      propagateOutsideClicks={false}
      onHidden={setInactive}
      style={suggestionOverlayStyle}
    >
      {children}
    </Kb.Overlay>
  )
}
