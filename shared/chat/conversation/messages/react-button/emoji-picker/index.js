// @flow
import * as React from 'react'
import {categories, emojiIndex, type EmojiData} from './data'
import {Box2, Emoji, SectionList, Text} from '../../../../../common-adapters'
import {globalColors, globalMargins, styleSheetCreate} from '../../../../../styles'
import {chunk} from 'lodash-es'

console.log('DANNYDEBUG', categories, emojiIndex)
// SectionList data is mostly static, map categories here
// and chunk data within component
const emojiSections = categories.map(c => ({
  category: c.category,
  data: {emojis: c.emojis, key: ''},
  key: c.category,
}))
const singleEmojiWidth = 22

type Section = {category: string, data: Array<{emojis: Array<EmojiData>, key: string}>, key: string}

type Props = {
  width: number,
}
type State = {
  sections: ?Array<Section>,
}
class EmojiPicker extends React.Component<Props, State> {
  state = {sections: null}
  _renderItem = ({item}: {item: {emojis: Array<EmojiData>, key: string}}) => {
    return (
      <Box2 key={item.key} fullWidth={true} centerChildren={true} direction="horizontal">
        {item.emojis.map(e => <Emoji size={singleEmojiWidth} emojiName={e.short_name} key={e.short_name} />)}
      </Box2>
    )
  }

  _renderSectionHeader = ({section}: {section: Section}) => (
    <Box2 direction="horizontal" fullWidth={true} style={styles.sectionHeader}>
      <Text type="BodySmall">{section.category}</Text>
    </Box2>
  )

  _chunkData() {
    const emojisPerLine = Math.floor(this.props.width / singleEmojiWidth)
    const sections = emojiSections.map(c => ({
      category: c.category,
      data: chunk(c.data.emojis, emojisPerLine).map(c => ({emojis: c, key: c[0].short_name})),
      key: c.key,
    }))
    this.setState({sections})
  }

  componentDidMount() {
    this._chunkData()
  }

  render() {
    return this.state.sections ? (
      <SectionList
        sections={this.state.sections}
        renderItem={this._renderItem}
        renderSectionHeader={this._renderSectionHeader}
      />
    ) : null
  }
}

const styles = styleSheetCreate({
  sectionHeader: {
    alignItems: 'center',
    backgroundColor: globalColors.white,
    height: 32,
    paddingLeft: globalMargins.tiny,
  },
})

export default EmojiPicker
