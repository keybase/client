// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {invert} from 'lodash-es'
import SuggestionList from './suggestion-list'

const lg = (...args) => console.log('DANNYDEBUG', ...args)

// For better performance, try not to recreate these objects on every render
// i.e. don't instantiate the objects inline (like dataSources={{...}})
type AddSuggestorsProps = {
  dataSources: {
    [key: string]: (filter: string) => Array<any>, // typing TODO
  },
  keyExtractors?: {
    [key: string]: (item: any) => string | number,
  },
  renderers: {
    [key: string]: (item: any, selected: boolean) => React.Node,
  },
  suggestionListStyle?: Styles.StylesCrossPlatform,
  suggestorToMarker: {
    [key: string]: string,
  },
  transformers: {
    [key: string]: (
      item: any,
      {text: string, position: {start: number, end: number}}
    ) => {
      text: string,
      selection: {start: number, end: number},
    },
  },
}

type AddSuggestorsState = {
  active: ?string,
  filter: string,
  selected: number,
}

type SuggestorHooks = {
  inputRef: {current: React.ElementRef<typeof Kb.PlainInput> | null},
  onChangeText: string => void,
  // Desktop only
  onKeyDown: (event: SyntheticKeyboardEvent<>, isComposingIME: boolean) => void,
  // Mobile only
  onBlur: () => void,
  onFocus: () => void,
  onSelectionChange: ({start: number, end: number}) => void,
}

export type PropsWithSuggestorOuter<P> = {|
  ...$Exact<P>,
  ...$Exact<AddSuggestorsProps>,
|}

export type PropsWithSuggestor<P> = {|
  ...$Exact<P>,
  ...$Exact<SuggestorHooks>,
|}

const AddSuggestors = <WrappedOwnProps: {}>(
  WrappedComponent: React.ComponentType<PropsWithSuggestor<WrappedOwnProps>>
): React.ComponentType<PropsWithSuggestorOuter<WrappedOwnProps>> => {
  class SuggestorsComponent extends React.Component<
    PropsWithSuggestorOuter<WrappedOwnProps>,
    AddSuggestorsState
  > {
    state = {active: null, filter: '', selected: 0}
    _inputRef = React.createRef<Kb.PlainInput>()
    _lastText = null
    _suggestors = Object.keys(this.props.suggestorToMarker)
    _markerToSuggestor: {[key: string]: string} = invert(this.props.suggestorToMarker)

    _getInputRef = () => this._inputRef.current

    _setInactive = () => this.setState(s => (s.active ? {active: null, filter: '', selected: 0} : null))

    _getWordAtCursor = () => {
      if (this._inputRef.current) {
        const input = this._inputRef.current
        const selection = input.getSelection()
        if (!selection || this._lastText === null) {
          return null
        }
        const text = this._lastText
        const upToCursor = text.substring(0, selection.start)
        const words = upToCursor.split(/ |\n/)
        const word = words[words.length - 1]
        const position = {end: selection.start, start: selection.start - word.length}
        return {position, word}
      }
      return null
    }

    _checkTrigger = text => {
      setTimeout(() => {
        // inside a timeout so selection will settle, there was a problem where
        // desktop would get the previous selection on arrowleft / arrowright
        lg('checktrigger', text)
        const cursorInfo = this._getWordAtCursor()
        if (!cursorInfo) {
          return
        }
        const {word} = cursorInfo
        if (this.state.active) {
          const activeMarker = this.props.suggestorToMarker[this.state.active]
          if (!word.startsWith(activeMarker)) {
            // not active anymore
            this._setInactive()
          } else {
            this.setState({filter: word.substring(activeMarker.length)})
            return
          }
        }
        for (let marker of Object.keys(this._markerToSuggestor)) {
          if (word.startsWith(marker)) {
            this.setState({active: this._markerToSuggestor[marker], filter: word.substring(marker.length)})
            lg('wut!', marker)
          }
        }
      }, 0)
    }

    _validateProps = () => {
      const {active} = this.state
      if (!active) {
        return
      }
      if (
        !this.props.dataSources[active] ||
        !this.props.renderers[active] ||
        !this.props.suggestorToMarker[active] ||
        !this.props.transformers[active]
      ) {
        throw new Error(
          `AddSuggestors: invalid props for suggestor '${active}', did you miss a key somewhere?`
        )
      }
    }

    _move = (up: boolean) =>
      this.setState(s => {
        if (!s.active) {
          return null
        }
        const length = this._getResults().length
        const selected = (((up ? s.selected - 1 : s.selected + 1) % length) + length) % length
        return selected === s.selected ? null : {selected}
      })

    _onChangeText = text => {
      lg('changetext', text)
      this._lastText = text
      // $FlowIssue TODO (DA) but I don't think this is an issue
      this.props.onChangeText && this.props.onChangeText(text)
      this._checkTrigger(text)
    }

    _onKeyDown = (evt: SyntheticKeyboardEvent<>, ici: boolean) => {
      lg('keydown')

      if (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') {
        this._checkTrigger(this._lastText || '')
      }

      if (!this.state.active || this._getResults().length === 0) {
        // not showing list, bail
        // $FlowIssue TODO (DA) but I don't think this is an issue
        this.props.onKeyDown && this.props.onKeyDown(evt, ici)
        return
      }

      let shouldCallParentCallback = true

      // check up or down
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
        this._triggerTransform(this._getResults()[this.state.selected])
        shouldCallParentCallback = false
      }

      if (shouldCallParentCallback) {
        // $FlowIssue TODO (DA) but I don't think this is an issue
        this.props.onKeyDown && this.props.onKeyDown(evt, ici)
      }
    }

    _onBlur = () => {
      // $FlowIssue TODO (DA) but I don't think this is an issue
      this.props.onBlur && this.props.onBlur()
      this._setInactive()
    }

    _onFocus = () => {
      // $FlowIssue TODO (DA) but I don't think this is an issue
      this.props.onFocus && this.props.onFocus()
      this._checkTrigger(this._lastText || '')
    }

    _onSelectionChange = selection => {
      // $FlowIssue TODO (DA) but I don't think this is an issue
      this.props.onSelectionChange && this.props.onSelectionChange()
      this._checkTrigger(this._lastText || '')
    }

    _triggerTransform = value => {
      lg('triggerTransform', value)
      if (this._inputRef.current && this.state.active) {
        const input = this._inputRef.current
        const active = this.state.active
        const cursorInfo = this._getWordAtCursor()
        if (!cursorInfo) {
          return
        }
        const transformedText = this.props.transformers[active](value, {
          position: cursorInfo.position,
          text: this._lastText || '',
        })
        input.transformText(textInfo => transformedText, true)
      }
    }

    _itemRenderer = (index, value) =>
      !this.state.active ? null : (
        <Kb.ClickableBox
          key={
            (this.props.keyExtractors &&
              this.props.keyExtractors[this.state.active] &&
              this.props.keyExtractors[this.state.active](value)) ||
            value
          }
          onClick={() => this._triggerTransform(value)}
          onMouseMove={() => this.setState(s => (s.selected === index ? null : {selected: index}))}
        >
          {this.props.renderers[this.state.active](
            value,
            Styles.isMobile ? false : index === this.state.selected
          )}
        </Kb.ClickableBox>
      )

    _getResults = () =>
      this.state.active ? this.props.dataSources[this.state.active](this.state.filter) : []

    render() {
      let overlay = null
      if (this.state.active) {
        this._validateProps()
      }
      const results = this._getResults()
      lg(results)
      if (results.length) {
        const content = (
          <Kb.Box2
            direction="vertical"
            style={Styles.collapseStyles([
              {backgroundColor: Styles.globalColors.white, maxHeight: 224, width: 320},
              this.props.suggestionListStyle,
            ])}
          >
            <SuggestionList
              items={results}
              renderItem={this._itemRenderer}
              selectedIndex={this.state.selected}
            />
          </Kb.Box2>
        )
        overlay = Styles.isMobile ? (
          <Kb.FloatingBox onHidden={this._setInactive}>{content}</Kb.FloatingBox>
        ) : (
          <Kb.Overlay
            attachTo={this._getInputRef}
            position="top center"
            visible={true}
            propagateOutsideClicks={false}
            onHidden={this._setInactive}
          >
            {content}
          </Kb.Overlay>
        )
      }

      const {
        dataSources,
        keyExtractors,
        renderers,
        suggestionListStyle,
        suggestorToMarker,
        transformers,
        ...wrappedOP
      } = this.props
      return (
        <>
          {overlay}
          <WrappedComponent
            {...wrappedOP}
            inputRef={this._inputRef}
            onBlur={this._onBlur}
            onFocus={this._onFocus}
            onChangeText={this._onChangeText}
            onKeyDown={this._onKeyDown}
            onSelectionChange={this._onSelectionChange}
          />
        </>
      )
    }
  }

  return SuggestorsComponent
}

export default AddSuggestors
