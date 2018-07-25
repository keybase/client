// @flow
import * as React from 'react'
import {categories, emojiIndex, type EmojiData} from './data'
import {Box2, Emoji, SectionList, Text} from '../../../../../common-adapters'
import {isMobile} from '../../../../../styles'
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
const emojiVariantSuffix = '\ufe0f'

type Props = {
  width: number,
}
type State = {
  chunked: boolean,
  sections: Array<{category: string, data: Array<{emojis: Array<EmojiData>, key: string}>, key: string}>,
}
class EmojiPicker extends React.Component<Props, State> {
  state = {chunked: false, sections: emojiSections}
  _renderItem = (args: {item: {emojis: Array<EmojiData>, key: string}}) => {
    // debugger
    return (
      <Box2 key={args.item.key} fullWidth={true} centerChildren={true} direction="horizontal">
        {args.item.emojis.map(
          e =>
            isMobile ? (
              <Text type="Body" style={{fontSize: singleEmojiWidth}}>
                {e.unified
                  .split('-')
                  .filter(a => a !== '200D')
                  .map(codepoint => String.fromCodePoint(parseInt(codepoint, 16)))
                  .join('\u200d') + emojiVariantSuffix}
              </Text>
            ) : (
              <Emoji size={singleEmojiWidth} emojiName={e.short_name} key={e.short_name} />
            )
        )}
      </Box2>
    )
  }

  _chunkData() {
    const emojisPerLine = Math.floor(this.props.width / singleEmojiWidth)
    const sections = emojiSections.map(c => ({
      ...c,
      data: chunk(c.data.emojis, emojisPerLine).map(c => ({emojis: c, key: c[0].short_name})),
    }))
    this.setState({chunked: true, sections})
  }

  componentDidMount() {
    this._chunkData()
  }

  render() {
    return this.state.chunked ? (
      <SectionList
        sections={this.state.sections}
        renderItem={this._renderItem}
        renderSectionHeader={() => null}
      />
    ) : null
  }
}

export default EmojiPicker
