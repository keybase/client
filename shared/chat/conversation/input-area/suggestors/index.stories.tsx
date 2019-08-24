import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import AddSuggestors, * as Suggestors from '.'

type TestAreaProps = Suggestors.PropsWithSuggestor<{
  somethingElse: 'this'
}>

class _TestArea extends React.Component<TestAreaProps> {
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

// @ts-ignore
const typingTests = () => {
  let test: unknown
  // @ts-ignore should error (bad other prop)
  test = <TestArea {...props} somethingElse="not this" />
  // @ts-ignore should error (bad suggestor prop)
  test = <TestArea {...props} dataSources={[1, 2]} />
  console.log(test)

  const missingSug = {
    renderers: {},
    somethingElse: 'this',
    suggestorToMarker: {},
    transformers: {},
  }
  // @ts-ignore should error (missing suggestor prop)
  test = <TestArea {...missingSug} />

  const missingOther = {
    dataSources: {},
    renderers: {},
    suggestorToMarker: {},
    transformers: {},
  }
  // @ts-ignore should error (missing other prop)
  test = <TestArea {...missingOther} />

  const extraJunk = {
    ...props,
    extra: 'oops',
  }
  // @ts-ignore should error (extra prop)
  test = <TestArea {...extraJunk} />

  const testAreaFunc = (_: TestAreaProps) => {}
  // @ts-ignore todo investigate
  AddSuggestors(testAreaFunc)
}

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
          backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white,
          padding: 10,
        }}
      />
    ),
    users: (username: string, selected) => (
      <Kb.NameWithIcon
        username={username}
        horizontal={true}
        containerStyle={{
          backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white,
          padding: 10,
        }}
      />
    ),
  },
  somethingElse: 'this', // used for typing tests
  suggestionListStyle: Styles.isMobile ? {marginTop: 80} : {width: 200},
  suggestorToMarker: {fruit: '$', users: '@'},
  transformers: {
    fruit: (fruit, _, tData, preview) => Suggestors.standardTransformer(`$${fruit}`, tData, preview),
    users: (username, _, tData, preview) => Suggestors.standardTransformer(`@${username}`, tData, preview),
  },
}

const availableTriggers = Object.values(props.suggestorToMarker)

// @ts-ignore
const load = () => Sb.storiesOf('Chat/Suggestors', module).add('Basic', () => <TestArea {...props} />)

export default load
