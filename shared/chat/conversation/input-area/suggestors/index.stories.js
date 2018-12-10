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
        width: 200,
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
  suggestionListStyle: Styles.isMobile ? {marginTop: 80} : {width: 200},
  suggestorToMarker: {fruit: '$'},
  transformers: {
    fruit: (item, {position: {end, start}, text}) => {
      const newText = text.substring(0, start) + '$' + item + ' ' + text.substring(end)
      const newPos = start + item.length + 2 // start of marker previously + length of inserted text + length of space
      return {selection: {end: newPos, start: newPos}, text: newText}
    },
  },
}

const availableTriggers = Object.values(props.suggestorToMarker)

const load = () =>
  Sb.storiesOf('Suggestors').add('Basic', () => <TestArea {...props} somethingElse={'this'} />)

export default load
