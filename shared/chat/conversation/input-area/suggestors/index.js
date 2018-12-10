// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {invert} from 'lodash-es'
import ChatUsers from './chat-users'
import SuggestionList from './suggestion-list'
import type {SuggestorDatasource} from './interface'

const lg = (...args) => console.log('DANNYDEBUG', ...args)

type AddSuggestorsProps = {
  dataSources: {
    [key: string]: (filter: string) => Array<any>, // typing TODO
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
  onKeyDown: (event: SyntheticKeyboardEvent<>, isComposingIME: boolean) => void,
}

export type PropsWithSuggestor<P> = {|
  ...$Exact<P>,
  ...$Exact<SuggestorHooks>,
|}

const AddSuggestors = <WrappedOwnProps: {}>(
  WrappedComponent: React.ComponentType<PropsWithSuggestor<WrappedOwnProps>>
): React.ComponentType<WrappedOwnProps & AddSuggestorsProps> => {
  class SuggestorsComponent extends React.Component<
    WrappedOwnProps & AddSuggestorsProps,
    AddSuggestorsState
  > {
    state = {active: null, filter: '', selected: 0}
    _inputRef = React.createRef<Kb.PlainInput>()
    _lastText = null
    _suggestors = Object.keys(this.props.suggestorToMarker)
    _markerToSuggestor: {[key: string]: string} = invert(this.props.suggestorToMarker)

    _getInputRef = () => this._inputRef.current

    _setInactive = () => this.setState({active: null, filter: '', selected: 0})

    _getWordAtCursor = () => {
      if (this._inputRef.current) {
        const input = this._inputRef.current
        const selection = input.getSelection()
        if (!selection || !this._lastText) {
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
      // $FlowIssue TODO (DA) but I don't think this is an issue
      this.props.onKeyDown && this.props.onKeyDown(evt, ici)

      if (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') {
        this._checkTrigger(this._lastText || '')
      }

      if (!this.state.active) {
        // not showing list, bail
        return
      }

      // check up or down
      if (evt.key === 'ArrowDown') {
        evt.preventDefault()
        this._move(false)
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault()
        this._move(true)
      } else if (evt.key === 'Enter') {
        this._triggerTransform(this._getResults()[this.state.selected])
      }
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
          key={value}
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

      const {dataSources, renderers, suggestorToMarker, transformers, ...wrappedOP} = this.props
      return (
        <>
          {overlay}
          <WrappedComponent
            {...wrappedOP}
            inputRef={this._inputRef}
            onChangeText={this._onChangeText}
            onKeyDown={this._onKeyDown}
          />
        </>
      )
    }
  }

  return SuggestorsComponent
}

export default AddSuggestors
