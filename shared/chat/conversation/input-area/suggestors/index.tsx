import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import invert from 'lodash/invert'
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

type AddSuggestorsState = {
  active?: string
  expanded: boolean
  filter: string
  selected: number
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

  class SuggestorsComponent extends React.Component<SuggestorsComponentProps, AddSuggestorsState> {
    _lastText?: string
    _suggestors = Object.keys(this.props.suggestorToMarker)
    _markerToSuggestor: {[K in string]: string} = invert(this.props.suggestorToMarker)
    _timeoutID?: ReturnType<typeof setTimeout>

    componentWillUnmount() {
      this._timeoutID && clearTimeout(this._timeoutID)
    }

    _getAttachmentRef: () => any = () => this.props.inputRef.current

    _getWordAtCursor = () => {
      if (this.props.inputRef.current) {
        const {useSpaces} = this._getResults()
        const input = this.props.inputRef.current
        const selection = input.getSelection()
        const text = this._lastText
        if (!selection || selection.start === null || text === undefined) {
          return null
        }
        const upToCursor = text.substring(0, selection.start)

        let wordRegex: string | RegExp

        // If the datasource has data which contains spaces, we can't just split by a space character.
        // So if we need to, we instead split on the next space which precedes another special marker
        if (useSpaces) {
          const markers = Object.values(this.props.suggestorToMarker).map(p =>
            p instanceof RegExp ? p.source : p
          )
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
    }

    _stabilizeSelection = () => {
      const {data} = this._getResults()
      if (this.props.selected > data.length - 1) {
        this.props.setSelected(0)
      }
    }

    _checkTrigger = () => {
      this._timeoutID = setTimeout(() => {
        // inside a timeout so selection will settle, there was a problem where
        // desktop would get the previous selection on arrowleft / arrowright
        const cursorInfo = this._getWordAtCursor()
        if (!cursorInfo) {
          return
        }
        const {word} = cursorInfo
        const {active} = this.props

        if (active) {
          const activeMarker = this.props.suggestorToMarker[active]
          const matchInfo = matchesMarker(word, activeMarker)
          if (!matchInfo.matches) {
            // not active anymore
            this.props.setInactive()
          } else {
            this.props.setFilter(word.substring(matchInfo.marker.length))
            // call this._stabilizeSelection?
            return
          }
        }
        // @ts-ignore we know entries will give this type
        for (let [suggestor, marker]: [string, string | RegExp] of Object.entries(
          this.props.suggestorToMarker
        )) {
          const matchInfo = matchesMarker(word, marker)
          if (matchInfo.matches && this.props.inputRef?.current?.isFocused()) {
            this.props.setActive(suggestor)
            this.props.setFilter(word.substring(matchInfo.marker.length))
          }
        }
      }, 0)
    }

    _move = (up: boolean) => {
      if (!this.props.active) {
        return
      }
      const length = this._getResults().data.length
      const selected = (((up ? this.props.selected - 1 : this.props.selected + 1) % length) + length) % length
      if (selected !== this.props.selected) {
        this.props.setSelected(selected)
      }
      // TODO after setState?
      // () => this._triggerTransform(this._getSelected(), false)
    }

    _onChangeText = (text: string) => {
      this._lastText = text
      this.props.onChangeText?.(text)
      this._checkTrigger()
    }

    _onKeyDown = (evt: React.KeyboardEvent) => {
      if (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') {
        this._checkTrigger()
      }

      if (!this.props.active || this._getResults().data.length === 0) {
        // not showing list, bail
        this.props.onKeyDown?.(evt)
        return
      }

      let shouldCallParentCallback = true

      // check trigger keys (up, down, enter, tab)
      if (evt.key === 'ArrowDown') {
        evt.preventDefault()
        this._move(false)
        shouldCallParentCallback = false
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault()
        this._move(true)
        shouldCallParentCallback = false
      } else if (evt.key === 'Enter') {
        evt.preventDefault()
        this._triggerTransform(this._getResults().data[this.props.selected])
        shouldCallParentCallback = false
      } else if (evt.key === 'Tab') {
        evt.preventDefault()
        if (this.props.filter.length) {
          this._triggerTransform(this._getSelected())
        } else {
          // shift held -> move up
          this._move(evt.shiftKey)
        }
        shouldCallParentCallback = false
      }

      if (shouldCallParentCallback) {
        this.props.onKeyDown?.(evt)
      }
    }

    _onBlur = () => {
      this.props.onBlur?.()
      this.props.setInactive()
    }

    _onFocus = () => {
      this.props.onFocus?.()
      this._checkTrigger()
    }

    _onSelectionChange = (selection: TransformerData['position']) => {
      this.props.onSelectionChange?.(selection)
      this._checkTrigger()
    }

    _triggerTransform = (value: any, final = true) => {
      if (this.props.inputRef.current && this.props.active) {
        const input = this.props.inputRef.current
        const {active} = this.props
        const cursorInfo = this._getWordAtCursor()
        if (!cursorInfo) {
          return
        }
        const matchInfo = matchesMarker(cursorInfo.word, this.props.suggestorToMarker[active])
        const transformedText = this.props.transformers[active](
          value,
          matchInfo.marker,
          {
            position: cursorInfo.position,
            text: this._lastText || '',
          },
          !final
        )
        this._lastText = transformedText.text
        input.transformText(() => transformedText, final)
      }
    }

    _itemRenderer = (index: number, value: string): React.ReactElement | null =>
      !this.props.active ? null : (
        <Kb.ClickableBox
          key={this.props.keyExtractors?.[this.props.active]?.(value) || value}
          onClick={() => this._triggerTransform(value)}
          onMouseMove={() => this.props.setSelected(index)}
        >
          {this.props.renderers[this.props.active](
            value,
            Styles.isMobile ? false : index === this.props.selected
          )}
        </Kb.ClickableBox>
      )

    _getResults = (): {data: any[]; loading: boolean; useSpaces: boolean} => {
      const {active} = this.props
      return active
        ? this.props.dataSources[active](this.props.filter)
        : {data: [], loading: false, useSpaces: false}
    }

    _getSelected = () => (this.props.active ? this._getResults().data[this.props.selected] : null)

    _onExpanded = (expanded: boolean) => {
      this.props.setExpanded(expanded)
    }

    render() {
      let overlay: React.ReactNode = null
      if (this.props.active) {
        this.props.validateProps()
      }
      let suggestionsVisible = false
      const results = this._getResults()
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
            attachTo={this._getAttachmentRef}
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
            onBlur={this._onBlur}
            onFocus={this._onFocus}
            onChangeText={this._onChangeText}
            onKeyDown={this._onKeyDown}
            onSelectionChange={this._onSelectionChange}
            onExpanded={this._onExpanded}
          />
        </>
      )
    }
  }

  const SuggestorsComponentOuter = (p: any) => {
    const {dataSources, renderers, suggestorToMarker, transformers} = p
    const {onChannelSuggestionsTriggered, onFetchEmoji} = p

    const [active, setActive] = React.useState('')
    const [expanded, setExpanded] = React.useState(false)
    const [filter, setFilter] = React.useState('')
    const [selected, setSelected] = React.useState(0)

    const setInactive = React.useCallback(() => {
      setActive('')
      setFilter('')
      setSelected(0)
    }, [setActive, setFilter, setSelected])

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

    const inputRef = React.useRef<Kb.PlainInput>()

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

    return (
      <SuggestorsComponent
        {...p}
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
