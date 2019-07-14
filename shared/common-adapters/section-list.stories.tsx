import * as React from 'react'
import {Box2} from './box'
import Text from './text'
import SectionList from './section-list'
import * as Sb from '../stories/storybook'
import * as Styles from '../styles'

const simpleRender = ({item}) => (
  <Text type="Body" style={styles.text}>
    {item}
  </Text>
)
const simpleHeaderRender = ({section}) => (
  <Box2
    direction="vertical"
    fullWidth={true}
    style={section.data.length % 2 ? styles.otherHeader : styles.header}
  >
    <Text type="Header" style={styles.text}>
      {section.title}
    </Text>
  </Box2>
)
const customRowRender = ({item}) => (
  <Text type="BodySemibold" style={styles.text}>
    SPECIAL: {item}
  </Text>
)

const small: Array<unknown> = []
for (let i = 0; i < 5; i++) {
  small.push({
    data: [`• item${i * 2 + 1}`, `• item${i * 2 + 2}`],
    title: `title${i + 1}`,
  })
}
const large: Array<unknown> = []
for (let i = 0; i < 500; i++) {
  const data: Array<unknown> = []
  const maxData = 5 + (i % 20)
  for (let j = 0; j < maxData; ++j) {
    data.push(`• item${j}`)
  }
  large.push({
    data,
    title: `title${i + 1}`,
  })
}

const customRow: Array<unknown> = [...small]
customRow[2] = {...customRow[2], renderItem: customRowRender}

const load = () => {
  Sb.storiesOf('Common/SectionList', module)
    .addDecorator(story => (
      <Box2 direction="vertical" style={{height: 300, width: '100%'}}>
        {story()}
      </Box2>
    ))
    .add('Small', () => (
      <SectionList sections={small} renderItem={simpleRender} renderSectionHeader={simpleHeaderRender} />
    ))
    .add('CustomRowRender', () => (
      <SectionList sections={customRow} renderItem={simpleRender} renderSectionHeader={simpleHeaderRender} />
    ))
    .add('CustomKeys', () => (
      <SectionList
        sections={customRow}
        renderItem={simpleRender}
        renderSectionHeader={simpleHeaderRender}
        keyExtractor={item => item.title || item}
      />
    ))
    .add('Large', () => (
      <SectionList sections={large} renderItem={simpleRender} renderSectionHeader={simpleHeaderRender} />
    ))
    .add('LargeSticky', () => (
      <SectionList
        stickySectionHeadersEnabled={true}
        sections={large}
        renderItem={simpleRender}
        renderSectionHeader={simpleHeaderRender}
      />
    ))
}

const styles = Styles.styleSheetCreate({
  header: {backgroundColor: 'grey'},
  otherHeader: {backgroundColor: 'orange'},
  text: {width: '100%'},
})

export default load
