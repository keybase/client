// @flow
import * as React from 'react'
import * as Container from '../../../../util/container'
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
  suggestorToMarker: {
    [key: string]: string,
  },
  transformers: {
    [key: string]: ({text: string, selection: {start: number, end: number}}) => {
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
    _suggestors = Object.keys(this.props.suggestorToMarker)
    _markerToSuggestor: {[key: string]: string} = invert(this.props.suggestorToMarker)

    _getInputRef = () => this._inputRef.current

    _setInactive = () => this.setState({active: null, filter: '', selected: 0})

    _checkTrigger = text => {
      const selection = (this._inputRef.current && this._inputRef.current.getSelection()) || {
        end: 0,
        start: 0,
      }
      lg('checktrigger', text)
      const upToCursor = text.substring(0, selection.start)
      const words = upToCursor.split(/ |\n/)
      const word = words[words.length - 1]
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
    }

    _move = (up: boolean) =>
      this.setState(s => {
        if (!s.active) {
          return null
        }
        const length = this.props.dataSources[s.active](s.filter).length
        const selected = (((up ? s.selected - 1 : s.selected + 1) % length) + length) % length
        return selected === s.selected ? null : {selected}
      })

    _onChangeText = text => {
      lg('changetext', text)
      this.props.onChangeText && this.props.onChangeText(text)
      this._checkTrigger(text)
    }

    _onKeyDown = (evt: SyntheticKeyboardEvent<>, ici: boolean) => {
      lg('keydown')
      this.props.onKeyDown && this.props.onKeyDown(evt, ici)

      // check up or down
      if (evt.key === 'ArrowDown') {
        evt.preventDefault()
        this._move(false)
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault()
        this._move(true)
      }
    }

    _triggerTransform = value => {
      // TODO
    }

    _itemRenderer = (index, value) =>
      !this.state.active ? null : (
        <Kb.ClickableBox
          key={value}
          onClick={() => this._triggerTransform(value)}
          onMouseMove={() => this.setState(s => (s.selected === index ? null : {selected: index}))}
        >
          {this.props.renderers[this.state.active](value, index === this.state.selected)}
        </Kb.ClickableBox>
      )

    render() {
      let overlay = null
      if (this.state.active) {
        const results = this.props.dataSources[this.state.active](this.state.filter)
        lg(results)
        if (results.length) {
          const content = (
            <Kb.Box2
              direction="vertical"
              style={{backgroundColor: Styles.globalColors.white, maxHeight: 224, width: 320}}
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
