import * as React from 'react'
import {Box2} from './box'
import Text from './text'
import {default as SectionList, Section} from './section-list'
import * as Sb from '../stories/storybook'
import * as Styles from '../styles'

const Kb = {
  Box2,
  SectionList,
  Text,
}

const simpleRender = ({item}) => (
  <Kb.Text type="Body" style={styles.text}>
    {item}
  </Kb.Text>
)
const simpleHeaderRender = ({section}) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={section.data.length % 2 ? styles.otherHeader : styles.header}
  >
    <Kb.Text type="Header" style={styles.text}>
      {section.title}
    </Kb.Text>
  </Kb.Box2>
)
const customRowRender = ({item}) => (
  <Kb.Text type="BodySemibold" style={styles.text}>
    SPECIAL: {item}
  </Kb.Text>
)

const small: Array<Section<string, {title: string}>> = []
for (let i = 0; i < 5; i++) {
  small.push({
    data: [`• item${i * 2 + 1}`, `• item${i * 2 + 2}`],
    title: `title${i + 1}`,
  })
}
const large: Array<Section<string, {title: string}>> = []
for (let i = 0; i < 500; i++) {
  const data: Array<string> = []
  const maxData = 5 + (i % 20)
  for (let j = 0; j < maxData; ++j) {
    data.push(`• item${j}`)
  }
  large.push({
    data,
    title: `title${i + 1}`,
  })
}

const customRow = [...small]
customRow[2] = {...customRow[2], renderItem: customRowRender}

const load = () => {
  Sb.storiesOf('Common/SectionList', module)
    .addDecorator(story => (
      <Kb.Box2 direction="vertical" style={{height: 300, width: '100%'}}>
        {story()}
      </Kb.Box2>
    ))
    .add('Small', () => (
      <Kb.SectionList sections={small} renderItem={simpleRender} renderSectionHeader={simpleHeaderRender} />
    ))
    .add('CustomRowRender', () => (
      <Kb.SectionList
        sections={customRow}
        renderItem={simpleRender}
        renderSectionHeader={simpleHeaderRender}
      />
    ))
    .add('CustomKeys', () => (
      <Kb.SectionList
        sections={customRow}
        renderItem={simpleRender}
        renderSectionHeader={simpleHeaderRender}
        keyExtractor={item => item}
        sectionKeyExtractor={section => section?.title}
      />
    ))
    .add('Large', () => (
      <Kb.SectionList sections={large} renderItem={simpleRender} renderSectionHeader={simpleHeaderRender} />
    ))
    .add('LargeSticky', () => (
      <Kb.SectionList
        stickySectionHeadersEnabled={true}
        sections={large}
        renderItem={simpleRender}
        renderSectionHeader={simpleHeaderRender}
      />
    ))
}

const styles = Styles.styleSheetCreate(() => ({
  header: {backgroundColor: 'grey'},
  otherHeader: {backgroundColor: 'orange'},
  text: {width: '100%'},
}))

export default load
