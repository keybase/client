// @flow
import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {invert} from 'lodash-es'
import ChatUsers from './chat-users'
import SuggestionList from './suggestion-list'
import type {Suggestor} from './interface'

const lg = (...args) => console.log('DANNYDEBUG', ...args)

type SuggestorName = 'chatUsers' | 'chatChannels' | 'emojis'
type Suggestors = Array<SuggestorName>

const suggestors: {[key: SuggestorName]: Suggestor} = {
  chatUsers: ChatUsers,
}

type OwnProps = {
  suggestors: Suggestors,
}

type SuggestorProps = {
  dataSources: {
    [key: SuggestorName]: (filter: string) => Array<any>, // typing TODO
  },
  renderers: {
    [key: SuggestorName]: (item: any, selected: boolean) => React.Node,
  },
  suggestorToMarker: {
    [key: SuggestorName]: string,
  },
  transformers: {
    [key: SuggestorName]: ({text: string, selection: {start: number, end: number}}) => {
      text: string,
      selection: {start: number, end: number},
    },
  },
}

type AddSuggestorsState = {
  active: ?SuggestorName,
  filter: string,
  selected: number,
}

export type SuggestorHooks = {
  inputRef: {current: React.ElementRef<typeof Kb.PlainInput> | null},
  onChangeText: string => void,
  onKeyDown: (event: SyntheticKeyboardEvent<>, isComposingIME: boolean) => void,
}

const _AddSuggestors = <WrappedOwnProps>(
  WrappedComponent: React.ComponentType<{...WrappedOwnProps, ...SuggestorHooks}>
): React.ComponentType<{...WrappedOwnProps, ...SuggestorProps}> => {
  class SuggestorsComponent extends React.Component<
    {...WrappedOwnProps, ...SuggestorProps},
    AddSuggestorsState
  > {
    state = {active: null, filter: '', selected: 0}
    _inputRef = React.createRef<Kb.PlainInput>()
    _suggestors = Object.keys(this.props.suggestorToMarker)
    _markerToSuggestor: {[key: string]: SuggestorName} = invert(this.props.suggestorToMarker)

    _getInputRef = () => this._inputRef.current

    _setInactive = () => this.setState({active: null, filter: '', selected: 0})

    _checkTrigger = text => {
      const selection = (this._inputRef.current && this._inputRef.current.getSelection()) || {
        end: 0,
        start: 0,
      }
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
      lg('changetext')
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
          overlay = (
            <Kb.Overlay
              attachTo={this._getInputRef}
              position="top center"
              visible={true}
              propagateOutsideClicks={false}
              onHidden={this._setInactive}
            >
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
            </Kb.Overlay>
          )
        }
      }
      return (
        <>
          {overlay}
          <WrappedComponent
            {...this.props}
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

const mapStateToProps = (state, ownProps) => {
  const ret = {
    dataSources: {},
    renderers: {},
    suggestorToMarker: {},
    transformers: {},
  }
  for (const suggestor of ownProps.suggestors) {
    ret.dataSources[suggestor] = suggestors[suggestor].getFilter(state)
    ret.renderers[suggestor] = suggestors[suggestor].render
    ret.suggestorToMarker[suggestor] = suggestors[suggestor].marker
    ret.transformers[suggestor] = suggestors[suggestor].transform
  }
  return ret
}

const mapDispatchToProps = (dispatch, ownProps) => ({})

const mergeProps = (s, d, o) => {
  const {suggestors, ...restOwnProps} = o
  return {...restOwnProps, ...s, ...d}
}

export const AddSuggestors = <P: OwnProps>(
  wrappedComponent: React.ComponentType<$Diff<P, OwnProps> & SuggestorHooks>
): React.ComponentType<P> =>
  Container.namedConnect<P, $Diff<P, OwnProps> & SuggestorProps, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    'AddSuggestors'
  )(_AddSuggestors<$Diff<P, OwnProps> & SuggestorProps>(wrappedComponent))

export default AddSuggestors
