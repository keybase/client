// @flow
import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import AddSuggestors, * as Suggestors from '.'

const _TestArea = (props: Suggestors.PropsWithSuggestor<{somethingElse: 'this'}>) => (
  <Kb.Box2 direction="vertical" gap="tiny" style={{padding: 10}}>
    <Kb.Text type="BodySmall">Available triggers: {availableTriggers.toLocaleString()}</Kb.Text>
    <Kb.PlainInput
      onChangeText={props.onChangeText}
      onKeyDown={props.onKeyDown}
      ref={props.inputRef}
      style={{
        borderColor: 'black',
        borderStyle: 'solid',
        borderWidth: 1,
        padding: 10,
        width: 400,
      }}
    />
  </Kb.Box2>
)
const TestArea = AddSuggestors(_TestArea)

// prettier-ignore
const fruit = ['apple', 'orange', 'raspberry', 'cantaloupe', 'durian', 'blackberry', 'fruit (generic)', 'mango', 'nectarine', 'pineapple', 'lemon']

const props = {
  dataSources: {fruit: filter => fruit.filter(f => f.includes(filter)).sort()},
  renderers: {
    fruit: (fruitName: string, selected) => (
      <Kb.NameWithIcon
        icon="iconfont-reacji-sheep"
        horizontal={true}
        title={fruitName}
        containerStyle={{
          backgroundColor: selected ? Styles.globalColors.blue4 : Styles.globalColors.white,
          padding: 10,
        }}
      />
    ),
  },
  suggestionListStyle: {width: 400},
  suggestorToMarker: {fruit: '$'},
  transformers: {fruit: input => input},
}

const availableTriggers = Object.values(props.suggestorToMarker)

const load = () =>
  Sb.storiesOf('Suggestors').add('Basic', () => <TestArea {...props} somethingElse={'this'} />)

export default load
