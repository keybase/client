import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {useMemo} from '../../../../util/memoize'
import SuggestionList from './suggestion-list'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

export type TransformerData = {
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

type AddSuggestorsProps = {
  lastText: React.MutableRefObject<string>
  setInactive: () => void
  active: string
  setActive: (a: string) => void
  expanded: boolean
  setExpanded: (e: boolean) => void
  filter: string
  setFilter: (f: string) => void
  selected: number
  setSelected: (s: number) => void
  dataSources: {[K in string]: (filter: string) => {data: Array<any>; loading: boolean; useSpaces: boolean}}
  keyExtractors?: {[K in string]: (item: any) => string}
  onChannelSuggestionsTriggered: () => void
  onFetchEmoji: () => void
  renderers: {[K in string]: (item: any, selected: boolean) => React.ElementType}
  suggestBotCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatusTyp
  suggestionListStyle?: Styles.StylesCrossPlatform
  suggestionOverlayStyle?: Styles.StylesCrossPlatform
  suggestionSpinnerStyle?: Styles.StylesCrossPlatform
  suggestorToMarker: {[K in string]: string | RegExp}
  transformers: {
    [K in string]: (
      item: any,
      marker: string,
      tData: TransformerData,
      preview: boolean
    ) => {
      text: string
      selection: {
        start: number
        end: number
      }
    }
  }
}

type SuggestorHooks = {
  suggestionsVisible: boolean
  inputRef: React.RefObject<Kb.PlainInput> | null
  onChangeText: (arg0: string) => void
  onKeyDown: (event: React.KeyboardEvent) => void
  onBlur: () => void
  onFocus: () => void
  onSelectionChange: (arg0: {start: number | null; end: number | null}) => void
  onExpanded: (e: boolean) => void
}

export type PropsWithSuggestorOuter<P> = P & AddSuggestorsProps
export type PropsWithSuggestor<P> = P & SuggestorHooks

const AddSuggestors = <WrappedOwnProps extends {}>(
  WrappedComponent: React.ComponentType<PropsWithSuggestor<WrappedOwnProps>>
): React.ComponentType<PropsWithSuggestorOuter<WrappedOwnProps>> => {
  type SuggestorsComponentProps = {
    forwardedRef: React.Ref<typeof WrappedComponent> | null
  } & PropsWithSuggestorOuter<WrappedOwnProps> &
    SuggestorHooks

  class SuggestorsComponent extends React.Component<SuggestorsComponentProps> {
    _onSelectionChange = (selection: TransformerData['position']) => {
      this.props.onSelectionChange?.(selection)
      this.props.checkTrigger()
    }

    _itemRenderer = (index: number, value: string): React.ReactElement | null =>
      !this.props.active ? null : (
        <Kb.ClickableBox
          key={this.props.keyExtractors?.[this.props.active]?.(value) || value}
          onClick={() => this.props.triggerTransform(value)}
          onMouseMove={() => this.props.setSelected(index)}
        >
          {this.props.renderers[this.props.active](
            value,
            Styles.isMobile ? false : index === this.props.selected
          )}
        </Kb.ClickableBox>
      )

    render() {
      let overlay: React.ReactNode = null
      if (this.props.active) {
        this.props.validateProps()
      }
      let suggestionsVisible = false
      const results = this.props.results
      const suggestBotCommandsUpdateStatus = this.props.suggestBotCommandsUpdateStatus
      if (
        results.data.length ||
        results.loading ||
        suggestBotCommandsUpdateStatus !== RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank
      ) {
        suggestionsVisible = true
        const active = this.props.active
        const content = results.data.length ? (
          <>
            <SuggestionList
              style={
                this.props.expanded
                  ? {bottom: 95, position: 'absolute', top: 95}
                  : this.props.suggestionListStyle
              }
              items={results.data}
              keyExtractor={
                (this.props.keyExtractors && !!active && this.props.keyExtractors[active]) || undefined
              }
              renderItem={this._itemRenderer}
              selectedIndex={this.props.selected}
              suggestBotCommandsUpdateStatus={suggestBotCommandsUpdateStatus}
            />
            {results.loading && (
              <Kb.ProgressIndicator
                type={Styles.isMobile ? undefined : 'Large'}
                style={this.props.suggestionSpinnerStyle}
              />
            )}
          </>
        ) : (
          <Kb.Box2
            direction="vertical"
            alignItems="center"
            fullWidth={true}
            style={Styles.collapseStyles([styles.spinnerBackground, this.props.suggestionListStyle])}
          >
            <Kb.ProgressIndicator type={Styles.isMobile ? undefined : 'Large'} />
          </Kb.Box2>
        )
        overlay = Styles.isMobile ? (
          <Kb.FloatingBox
            containerStyle={this.props.suggestionOverlayStyle}
            dest="keyboard-avoiding-root"
            onHidden={this.props.setInactive}
          >
            {content}
          </Kb.FloatingBox>
        ) : (
          <Kb.Overlay
            attachTo={this.props.getAttachmentRef}
            matchDimension={true}
            position="top center"
            positionFallbacks={['bottom center']}
            visible={true}
            propagateOutsideClicks={false}
            onHidden={this.props.setInactive}
            style={this.props.suggestionOverlayStyle}
          >
            {content}
          </Kb.Overlay>
        )
      }

      const {
        dataSources,
        forwardedRef,
        keyExtractors,
        renderers,
        suggestionListStyle,
        suggestionOverlayStyle,
        suggestorToMarker,
        transformers,
        ...wrappedOP
      } = this.props

      return (
        <>
          {overlay}
          <WrappedComponent
            {...(wrappedOP as WrappedOwnProps)}
            suggestBotCommandsUpdateStatus={suggestBotCommandsUpdateStatus}
            suggestionsVisible={suggestionsVisible}
            inputRef={this.props.inputRef}
            onBlur={this.props.onBlur}
            onFocus={this.props.onFocus}
            onChangeText={this.props.onChangeText}
            onKeyDown={this.props.onKeyDown}
            onSelectionChange={this._onSelectionChange}
            onExpanded={this.props.setExpanded}
          />
        </>
      )
    }
  }

  // needed?
  // _stabilizeSelection = () => {
  //   const {data} = this.props.getResults()
  //   if (this.props.selected > data.length - 1) {
  //     this.props.setSelected(0)
  //   }
  // }

  const SuggestorsComponentOuter = (p: any) => {
    const {dataSources, renderers, suggestorToMarker, transformers, onChangeText, onKeyDown} = p
    const {onChannelSuggestionsTriggered, onFetchEmoji, onBlur, userEmojisLoading, onFocus} = p

    const [active, setActive] = React.useState('')
    const [expanded, setExpanded] = React.useState(false)
    const [filter, setFilter] = React.useState('')
    const [selected, setSelected] = React.useState(0)
    const inputRef = React.useRef<Kb.PlainInput>()
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
        throw new Error(
          `AddSuggestors: invalid props for suggestor '${active}', did you miss a key somewhere?`
        )
      }
    }, [active, dataSources, renderers, suggestorToMarker, transformers])

    const onBlur2 = React.useCallback(() => {
      onBlur?.()
      setInactive()
    }, [onBlur, setInactive])

    const getAttachmentRef = React.useCallback(() => inputRef.current, [inputRef])

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
        }
        // TODO after setState?
        // () => this._triggerTransform(this._getSelected(), false)
      },
      [active, results, selected, setSelected]
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
    }, [
      getWordAtCursor,
      triggerIDRef,
      setActive,
      setFilter,
      suggestorToMarker,
      setInactive,
      active,
      inputRef,
    ])

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

    return (
      <SuggestorsComponent
        {...p}
        onFocus={onFocus2}
        onKeyDown={onKeyDown2}
        onChangeText={onChangeText2}
        move={move}
        triggerTransform={triggerTransform}
        checkTrigger={checkTrigger}
        getWordAtCursor={getWordAtCursor}
        onBlur={onBlur2}
        getSelected={getSelected}
        results={results}
        lastText={lastText}
        getAttachmentRef={getAttachmentRef}
        inputRef={inputRef}
        validateProps={validateProps}
        setInactive={setInactive}
        active={active}
        setActive={setActive}
        expanded={expanded}
        setExpanded={setExpanded}
        filter={filter}
        setFilter={setFilter}
        selected={selected}
        setSelected={setSelected}
      />
    )
  }
  // @ts-ignore TODO fix these types
  return React.forwardRef((props, ref) => <SuggestorsComponentOuter {...props} forwardedRef={ref} />)
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

export {standardTransformer}
export default AddSuggestors
