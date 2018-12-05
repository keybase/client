// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'

type SuggestorProps = {
  dataSources: {
    [key: string]: (filter: string) => Array<any>, // TODO
  },
  renderers: {
    [key: string]: (item: any) => React.Node,
  },
  transformers: {
    [key: string]: ({text: string, selection: {start: number, end: number}}) => {
      text: string,
      selection: {start: number, end: number},
    },
  },
}

type AddedProps = {
  onChangeText: string => void,
  onKeyDown: (event: SyntheticKeyboardEvent<>, isComposingIME: boolean) => void,
}

const AddSuggestors = <OuterProps: $Subtype<SuggestorProps>>(
  WrappedComponent: React.ComponentType<OuterProps & AddedProps>
): React.ComponentType<OuterProps> => {
  class SuggestorsComponent extends React.Component<OuterProps> {
    _inputRef = React.createRef<Kb.Input>()
    onChangeText = text => {
      this.props.onChangeText && this.props.onChangeText(text)
    }

    onKeyDown = (evt, ici) => {
      this.props.onKeyDown && this.props.onKeyDown(evt, ici)
    }

    render() {
      return (
        <WrappedComponent
          {...this.props}
          inputRef={this._inputRef}
          onChangeText={this.onChangeText}
          onKeyDown={this.onKeyDown}
        />
      )
    }
  }

  return SuggestorsComponent
}

export default AddSuggestors
