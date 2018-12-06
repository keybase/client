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
  active: ?SuggestorName,
  filter: string,
  selected: number,
}

export type SuggestorHooks = {
  inputRef: {current: React.ElementRef<typeof Kb.PlainInput> | null},
  onChangeText: string => void,
  onKeyDown: (event: SyntheticKeyboardEvent<>, isComposingIME: boolean) => void,
}

const _AddSuggestors = <OuterProps: $Subtype<SuggestorProps>>(
  WrappedComponent: React.ComponentType<$Diff<OuterProps, SuggestorProps> & SuggestorHooks>
): React.ComponentType<OuterProps> => {
  class SuggestorsComponent extends React.Component<OuterProps, AddSuggestorsState> {
    state = {active: null, filter: '', selected: 0}
    _inputRef = React.createRef<Kb.PlainInput>()
    _suggestors = Object.keys(this.props.suggestorToMarker)
    _markerToSuggestor = invert(this.props.suggestorToMarker)

    _getInputRef = () => this._inputRef.current

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
          this.setState({active: null, filter: '', selected: 0})
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

    _onChangeText = text => {
      lg('changetext')
      this.props.onChangeText && this.props.onChangeText(text)
      this._checkTrigger(text)
    }

    _onKeyDown = (evt, ici) => {
      lg('keydown')
      this.props.onKeyDown && this.props.onKeyDown(evt, ici)
    }

    _itemRenderer = (index, value) => (
      <Kb.Box onMouseMove={() => this.setState(s => (s.selected === index ? null : {selected: index}))}>
        {this.props.renderers[this.state.active](value, index === this.state.selected)}
      </Kb.Box>
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
              onHidden={() => {}}
            >
              <Kb.Box2
                direction="vertical"
                style={{backgroundColor: Styles.globalColors.white, maxHeight: 224, width: 320}}
              >
                <SuggestionList items={results} renderItem={this._itemRenderer} />
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
