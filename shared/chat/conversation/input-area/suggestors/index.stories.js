// @flow
import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import * as Kb from '../../../../common-adapters'
import AddSuggestors, * as Suggestors from '.'

const _TestArea = (props: Suggestors.PropsWithSuggestor<{}>) => (
  <Kb.PlainInput
    onChangeText={props.onChangeText}
    onKeyDown={props.onKeyDown}
    ref={props.inputRef}
    style={{borderColor: 'black', borderStyle: 'solid', borderWidth: 1, margin: 10, padding: 10}}
  />
)
const TestArea = AddSuggestors(_TestArea)

const props = {
  dataSources: {},
  renderers: {},
  suggestorToMarker: {},
  transformers: {},
}

const load = () => Sb.storiesOf('Suggestors').add('Basic', () => <TestArea {...props} />)

export default load
