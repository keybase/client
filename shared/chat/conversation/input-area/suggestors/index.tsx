import * as Channels from './channels'
import * as Commands from './commands'
import * as Emoji from './emoji'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Users from './users'
import * as InputState from '../input-state'
import type * as Common from './common'
import type {PlatformInputProps as Props, RefType as InputRef} from '../normal/input.shared'
import {useComposer, type Composer} from '../composer'
import type {Suggestions} from '../composer-keys'
import {useConversationThreadID} from '../../thread-context'
import {KeyboardStickyView} from 'react-native-keyboard-controller'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {composerStickyOffset} from '@/chat/conversation/composer-geometry'
import {default as Reanimated} from '@/common-adapters/reanimated'

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

type TransformerType = {
  [key in keyof typeof transformers]: Parameters<(typeof transformers)[key]>[0]
}

// Unanchored and capture-free on purpose: these sources are anchored into the
// per-suggestor markers below AND dropped raw into the word-split lookahead, where
// a '^' sits mid-pattern and can never match, and a capture group would make
// String.split interleave the captures with the words.
const markerSources = {
  channels: '#',
  commands: '(?:!|/)',
  emoji: '\\+?:',
  // 'users' is for @user, @team, and @team#channel
  users: '(?:\\+\\d+(?:\\.\\d+)?[a-zA-Z]{3,12}@|@)', // normal mentions and ones in a stellar send
} as const

const suggestorToMarker = {
  channels: markerSources.channels,
  commands: new RegExp(`^${markerSources.commands}`),
  emoji: new RegExp(`^${markerSources.emoji}`),
  // deliberately unanchored: a stellar send puts the marker mid-word
  users: new RegExp(markerSources.users),
} as const

// Datasources whose entries contain spaces (bot commands are `!keybot cancel`)
// can't split on a plain space, so a command word instead splits on the space that
// precedes the next suggestor marker.
const commandWordSplit = new RegExp(` (?=${Object.values(markerSources).join('|')})`, 'g')
const plainWordSplit = / |\n/

type UseSuggestorsProps = Pick<
  Props,
  'onChangeText' | 'suggestionOverlayStyle'
> & {
  suggestionListStyle: Kb.Styles.StylesCrossPlatform
  suggestionSpinnerStyle: Kb.Styles.StylesCrossPlatform
  // what the desktop list is placed against; phones show it above the keyboard instead
  popupAnchorRef?: React.RefObject<InputRef | null>
}

// nasty to mix these types but keeping this for now
type ActiveType = '' | 'channels' | 'commands' | 'emoji' | 'users'
type SelectedType = Parameters<(typeof transformers)['channels' | 'commands' | 'emoji' | 'users']>[0]

// handles watching the input and seeing which suggestor we need to use
type UseSyncInputProps = {
  active: ActiveType
  composer: Composer
  setActive: React.Dispatch<React.SetStateAction<ActiveType>>
  setFilter: React.Dispatch<React.SetStateAction<string>>
  selectedItemRef: React.RefObject<undefined | SelectedType>
  setCommandInputSnapshot: (snapshot: Commands.CommandInputSnapshot) => void
  setSnapshotText: (text: string) => void
}

const useSyncInput = (p: UseSyncInputProps) => {
  const {
    composer,
    active,
    setActive,
    setFilter,
    selectedItemRef,
    setCommandInputSnapshot,
    setSnapshotText,
  } = p
  // Arrowing through a list shows each pick in the input without reporting it. The user saw it,
  // so a list closing on one (Escape, a blur, the caret leaving the word, leaving the conversation)
  // keeps it as their text. Picking is not typing, so it is kept, never reported as typed.
  const previewRef = React.useRef<string | undefined>(undefined)
  const keepPreview = () => {
    const preview = previewRef.current
    previewRef.current = undefined
    if (preview !== undefined && preview === composer.getText()) {
      composer.keepText()
    }
  }
  const setInactive = () => {
    keepPreview()
    setActive('')
    setFilter('')
  }
  // A layout cleanup, so it runs before the input detaches and its detach flushes the draft.
  const keepPreviewOnLeave = React.useEffectEvent(keepPreview)
  React.useLayoutEffect(() => () => keepPreviewOnLeave(), [])

  const getInputSnapshot = (): Commands.CommandInputSnapshot => ({
    selection: composer.getSelection(),
    text: composer.getText(),
  })

  // with no input attached there is no selection, so no word
  const getWordAtCursor = (inputSnapshot: Commands.CommandInputSnapshot) => {
    const {selection, text} = inputSnapshot
    // eslint-disable-next-line
    if (!selection || selection.start === null) {
      return null
    }

    // move selection to end of the selected word so replacements don't squish with text after
    const startIdx = Math.min(selection.start, text.length)
    const nextSpaceIndex = text.indexOf(' ', startIdx)
    const toReplaceEnd = nextSpaceIndex !== -1 ? nextSpaceIndex : text.length

    const upToCursor = text.substring(0, toReplaceEnd)

    // Which split applies can only be told from the word itself: `active` is a
    // keystroke behind and pasted text never gets a follow-up keystroke to
    // correct it. So take the command split and keep it only when the word it
    // yields really is a command, otherwise fall back to plain spaces.
    let lastWordPrefix = upToCursor.split(commandWordSplit).at(-1) ?? ''
    if (!suggestorToMarker.commands.test(lastWordPrefix)) {
      lastWordPrefix = upToCursor.split(plainWordSplit).at(-1) ?? ''
    }
    const toReplaceStart = toReplaceEnd - lastWordPrefix.length
    const position = {end: toReplaceEnd, start: toReplaceStart}

    const word = text.substring(toReplaceStart, toReplaceEnd)
    return {position, word}
  }

  const triggerIDRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const checkTrigger = () => {
    if (triggerIDRef.current) {
      clearTimeout(triggerIDRef.current)
    }
    triggerIDRef.current = setTimeout(() => {
      // inside a timeout so selection will settle, there was a problem where
      // desktop would get the previous selection on arrowleft / arrowright
      const inputSnapshot = getInputSnapshot()
      setCommandInputSnapshot(inputSnapshot)
      const cursorInfo = getWordAtCursor(inputSnapshot)
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
        if (matchInfo.matches && composer.isFocused()) {
          setActive(suggestor as ActiveType)
          setFilter(word.substring(matchInfo.marker.length))
        }
      }
    }, 1)
  }

  React.useEffect(() => {
    return () => {
      clearTimeout(triggerIDRef.current)
    }
  }, [])

  const triggerTransform = function (maybeValue: SelectedType | undefined, final = true) {
    if (!active) {
      return
    }
    const value = maybeValue ?? selectedItemRef.current
    if (!value) {
      return
    }
    const inputSnapshot = getInputSnapshot()
    // with no input attached there is no caret to transform at
    if (!inputSnapshot.selection) {
      return
    }
    setCommandInputSnapshot(inputSnapshot)
    const cursorInfo = getWordAtCursor(inputSnapshot)
    const matchInfo = matchesMarker(cursorInfo?.word ?? '', suggestorToMarker[active])

    let transformedText: {
      selection: {
        end: number
        start: number
      }
      text: string
    }

    const transformRest = [
      matchInfo.marker,
      {position: cursorInfo?.position ?? {end: null, start: null}, text: inputSnapshot.text},
      !final,
    ] as const

    // nasty but the typing is hard since its ambiguous here
    switch (active) {
      case 'channels':
        transformedText = transformers[active](value as TransformerType['channels'], ...transformRest)
        break
      case 'commands':
        transformedText = transformers[active](value as TransformerType['commands'], ...transformRest)
        break
      case 'emoji':
        transformedText = transformers[active](value as TransformerType['emoji'], ...transformRest)
        break
      case 'users':
        transformedText = transformers[active](value as TransformerType['users'], ...transformRest)
        break
    }
    if (composer.replace(transformedText, final)) {
      setSnapshotText(transformedText.text)
      previewRef.current = final ? undefined : transformedText.text
    }
  }

  return {
    active,
    checkTrigger,
    setActive,
    setInactive,
    triggerTransform,
  }
}

export const useSuggestors = (p: UseSuggestorsProps) => {
  const selectedItemRef = React.useRef<undefined | SelectedType>(undefined)
  const composer = useComposer()
  const [commandInputSnapshot, setCommandInputSnapshot] = React.useState<Commands.CommandInputSnapshot>({
    selection: undefined,
    text: '',
  })
  const setCommandInputSnapshotIfChanged = (snapshot: Commands.CommandInputSnapshot) => {
    setCommandInputSnapshot(previous =>
      previous.text === snapshot.text &&
      previous.selection?.start === snapshot.selection?.start &&
      previous.selection?.end === snapshot.selection?.end
        ? previous
        : snapshot
    )
  }
  const setSnapshotText = (text: string) => {
    setCommandInputSnapshot(previous => (previous.text === text ? previous : {...previous, text}))
  }
  const [active, setActive] = React.useState<ActiveType>('')
  const [filter, setFilter] = React.useState('')
  const suppressCommandSuggestions = InputState.useConversationInput(s => !!s.commandMarkdown || s.giphyWindow)
  const {popupAnchorRef, suggestionListStyle, suggestionOverlayStyle} = p
  const {onChangeText: onChangeTextProps} = p
  const {suggestionSpinnerStyle} = p
  const conversationIDKey = useConversationThreadID()
  const botCommandsUpdateState = Commands.useBotCommandsUpdateState(conversationIDKey)
  const {triggerTransform, checkTrigger, setInactive} = useSyncInput({
    active,
    composer,
    selectedItemRef,
    setActive,
    setCommandInputSnapshot: setCommandInputSnapshotIfChanged,
    setFilter,
    setSnapshotText,
  })

  const listRef = React.useRef<Common.ListHandle>(undefined)
  // read when a key lands
  const getSuggestions = (): Suggestions =>
    !listRef.current
      ? 'none'
      : !listRef.current.hasItems()
        ? 'empty'
        : filter.length === 0
          ? 'unfiltered'
          : 'filtered'
  const moveSuggestion = (up: boolean) => {
    listRef.current?.move(up)
  }
  const selectSuggestion = () => !!listRef.current?.submit()

  const onBlur = () => {
    setInactive()
  }

  const onChangeText = (text: string) => {
    setSnapshotText(text)
    onChangeTextProps(text)
    checkTrigger()
  }

  const onFocus = () => {
    checkTrigger()
  }

  const onSelected = (item: unknown, final: boolean) => {
    selectedItemRef.current = item as SelectedType
    triggerTransform(item as SelectedType, final)
  }

  const listProps = {
    conversationIDKey,
    filter,
    listStyle: suggestionListStyle,
    onSelected,
    setListHandle: (h: Common.ListHandle | undefined) => {
      listRef.current = h
    },
    spinnerStyle: suggestionSpinnerStyle,
    suggestBotCommandsUpdateStatus: botCommandsUpdateState.status,
  }

  let content: React.ReactNode = null
  switch (active) {
    case 'channels':
      content = <Channels.List {...listProps} />
      break
    case 'commands':
      content = (
        <Commands.List
          {...listProps}
          botSettings={botCommandsUpdateState.settings}
          inputSnapshot={commandInputSnapshot}
          suppressCommandSuggestions={suppressCommandSuggestions}
        />
      )
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
    <Popup suggestionOverlayStyle={suggestionOverlayStyle} setInactive={setInactive} anchorRef={popupAnchorRef}>
      {content}
    </Popup>
  )

  return {
    closeSuggestions: setInactive,
    onBlur,
    onChangeText,
    onFocus,
    moveSuggestion,
    onSelectionChange: (_selection: Common.TransformerData['position']) => { checkTrigger() },
    popup,
    recheckSuggestions: checkTrigger,
    getSuggestions,
    selectSuggestion,
    suggestionsShowing: !!content,
  }
}

type PopupProps = {
  suggestionOverlayStyle: Kb.Styles.StylesCrossPlatform
  setInactive: () => void
  anchorRef?: React.RefObject<InputRef | null>
  children: React.ReactNode
}
const MobileSuggestionArea = (p: {children: React.ReactNode}) => {
  const styles = useStyles()
  // @gorhom/portal renders this at the popup host, a sibling of the router, so
  // the conversation's contexts never reach it and the inset has to come from
  // a hook here
  const insets = useSafeAreaInsets()
  // the input bar sits insets.bottom above the window bottom while the keyboard
  // is closed, so mirror its offset or this list covers the input
  const stickyOffset = React.useMemo(() => composerStickyOffset(insets.bottom), [insets.bottom])

  return (
    <KeyboardStickyView offset={stickyOffset} pointerEvents="box-none" style={styles.sticky}>
      <Reanimated.View pointerEvents="box-none" style={styles.area}>
        {p.children}
      </Reanimated.View>
    </KeyboardStickyView>
  )
}

// phones place the list above the keyboard, not against an anchor
const unanchored: React.RefObject<InputRef | null> = {current: null}

const Popup = (p: PopupProps) => {
  const {children, suggestionOverlayStyle, setInactive, anchorRef} = p

  const attachRef = (anchorRef ?? unanchored) as React.RefObject<Kb.MeasureRef | null>

  return (
    <Kb.AnchoredPopup
      attachTo={attachRef}
      matchDimension={true}
      position="top center"
      positionFallbacks={positionFallbacks}
      propagateOutsideClicks={false}
      onHidden={setInactive}
      containerStyle={suggestionOverlayStyle}
      style={suggestionOverlayStyle}
    >
      {isMobile ? <MobileSuggestionArea>{children}</MobileSuggestionArea> : children}
    </Kb.AnchoredPopup>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  area: {marginTop: 'auto'},
  sticky: {flexGrow: 1, flexShrink: 1},
}))
