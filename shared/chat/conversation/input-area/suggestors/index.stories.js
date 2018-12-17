// @flow
import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import AddSuggestors, * as Suggestors from '.'

class _TestArea extends React.Component<Suggestors.PropsWithSuggestor<{somethingElse: 'this'}>> {
  render() {
    return (
      <Kb.Box2 direction="vertical" gap="tiny" style={{padding: 10}}>
        <Kb.Text type="BodySmall" selectable={true}>
          Available triggers: {availableTriggers.toLocaleString()}
        </Kb.Text>
        <Kb.PlainInput
          onBlur={this.props.onBlur}
          onFocus={this.props.onFocus}
          onChangeText={this.props.onChangeText}
          onKeyDown={this.props.onKeyDown}
          onSelectionChange={this.props.onSelectionChange}
          multiline={true}
          rowsMax={3}
          ref={this.props.inputRef}
          style={{
            borderColor: 'black',
            borderStyle: 'solid',
            borderWidth: 1,
            width: 200,
          }}
        />
      </Kb.Box2>
    )
  }
}
const TestArea = AddSuggestors(_TestArea)

// prettier-ignore
const fruit = ['apple', 'orange', 'raspberry', 'cantaloupe', 'durian', 'blackberry', 'fruit_generic', 'mango', 'nectarine', 'pineapple', 'lemon']
// prettier-ignore
const users = ['mlsteele', 'mikem', 'ayoubd', 'max', 'chrisnojima', 'chris', 'aimeedavid', 'jakob223', 'joshblum', 'xgess', 'modalduality', 'kurt']

const props = {
  dataSources: {
    fruit: filter => fruit.filter(f => f.includes(filter)).sort(),
    users: filter => users.filter(u => u.includes(filter)).sort(),
  },
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
    users: (username: string, selected) => (
      <Kb.NameWithIcon
        username={username}
        horizontal={true}
        containerStyle={{
          backgroundColor: selected ? Styles.globalColors.blue4 : Styles.globalColors.white,
          padding: 10,
        }}
      />
    ),
  },
  suggestionListStyle: Styles.isMobile ? {marginTop: 80} : {width: 200},
  suggestorToMarker: {fruit: '$', users: '@'},
  transformers: {
    fruit: (item, {position: {end, start}, text}, preview) => {
      const newText = text.substring(0, start) + '$' + item + (preview ? '' : ' ') + text.substring(end)
      const newPos = start + item.length + (preview ? 1 : 2) // start of marker previously + length of inserted text + length of space
      return {selection: {end: newPos, start: newPos}, text: newText}
    },
    users: (item, {position: {end, start}, text}, preview) => {
      const newText = text.substring(0, start) + '@' + item + (preview ? '' : ' ') + text.substring(end)
      const newPos = start + item.length + (preview ? 1 : 2)
      return {selection: {end: newPos, start: newPos}, text: newText}
    },
  },
}

const availableTriggers = Object.values(props.suggestorToMarker)

const load = () =>
  Sb.storiesOf('Chat/Suggestors').add('Basic', () => <TestArea {...props} somethingElse={'this'} />)

export default load
