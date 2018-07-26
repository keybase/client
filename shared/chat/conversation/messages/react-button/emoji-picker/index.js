// @flow
import * as React from 'react'
import {categories, type EmojiData} from './data'
import {ClickableBox, Box2, Emoji, SectionList, Text} from '../../../../../common-adapters'
import {globalColors, globalMargins, styleSheetCreate} from '../../../../../styles'
import {chunk} from 'lodash-es'

// SectionList data is mostly static, map categories here
// and chunk data within component
const emojiSections = categories.map(c => ({
  category: c.category,
  data: {emojis: c.emojis, key: ''},
  key: c.category,
}))
const singleEmojiWidth = 22
const emojiPadding = 4

type Section = {category: string, data: Array<{emojis: Array<EmojiData>, key: string}>, key: string}

type Props = {
  filter?: string,
  onChoose: (emoji: EmojiData) => void,
  width: number,
}
type State = {
  sections: ?Array<Section>,
}
class EmojiPicker extends React.Component<Props, State> {
  state = {sections: null}
  _renderItem = ({item}: {item: {emojis: Array<EmojiData>, key: string}}) => {
    return (
      <Box2 key={item.key} fullWidth={true} style={styles.alignItemsCenter} direction="horizontal">
        {item.emojis.map(e => (
          <ClickableBox onClick={() => this.props.onChoose(e)} style={styles.emoji} key={e.short_name}>
            <Emoji size={singleEmojiWidth} emojiName={e.short_name} />
          </ClickableBox>
        ))}
      </Box2>
    )
  }

  _renderSectionHeader = ({section}: {section: Section}) => (
    <Box2 direction="horizontal" fullWidth={true} style={styles.sectionHeader}>
      <Text type="BodySmall">{section.category}</Text>
    </Box2>
  )

  _chunkData() {
    let sections = []
    if (this.props.filter) {
    } else {
      const emojisPerLine = Math.floor(this.props.width / (singleEmojiWidth + 2 * emojiPadding))
      sections = emojiSections.map(c => ({
        category: c.category,
        data: chunk(c.data.emojis, emojisPerLine).map(c => ({emojis: c, key: c[0].short_name})),
        key: c.key,
      }))
    }
    this.setState({sections})
  }

  componentDidMount() {
    this._chunkData()
  }

  render() {
    return this.state.sections ? (
      <SectionList
        sections={this.state.sections}
        stickySectionHeadersEnabled={true}
        renderItem={this._renderItem}
        renderSectionHeader={this._renderSectionHeader}
      />
    ) : null
  }
}

const styles = styleSheetCreate({
  alignItemsCenter: {
    alignItems: 'center',
  },
  emoji: {
    padding: emojiPadding,
  },
  sectionHeader: {
    alignItems: 'center',
    backgroundColor: globalColors.white,
    height: 32,
    paddingLeft: globalMargins.tiny,
  },
})

export default EmojiPicker
