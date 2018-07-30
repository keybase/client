// @flow
import * as React from 'react'
import {categories, emojiIndex, emojiNameMap, type EmojiData} from './data'
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
const singleEmojiWidth = 32
const emojiPadding = 4
const maxEmojiSearchResults = 50

// Usually this emoji picker will be full-width on mobile
// Cache the width & sections after the first render so we
// can render a good initial guess
let cachedWidth = 0
let cachedSections = null

type Section = {
  category: string,
  data: Array<{emojis: Array<EmojiData>, onChoose: (emoji: EmojiData) => void, key: string}>,
  key: string,
}

type Props = {
  filter?: string,
  onChoose: (emoji: EmojiData) => void,
  width: number,
}
type State = {
  sections: ?Array<Section>,
}
class EmojiPicker extends React.Component<Props, State> {
  state = {sections: cachedSections}

  _chunkData = () => {
    if (!this.props.width) {
      return
    }
    if (this.props.width === cachedWidth && !this.props.filter) {
      this.setState(s => (s.sections === cachedSections ? null : {sections: cachedSections}))
      return
    }
    // width is different from cached or we have a filter
    let sections = []
    const emojisPerLine = Math.floor(this.props.width / (singleEmojiWidth + 2 * emojiPadding))
    if (this.props.filter) {
      const filter = this.props.filter
      const results = emojiIndex
        .search(filter, {maxResults: maxEmojiSearchResults})
        .map(res => emojiNameMap[res.id])
      sections = [
        {
          category: filter,
          data: chunk(results, emojisPerLine).map(c => ({
            emojis: c,
            key: c[0].short_name,
            onChoose: this.props.onChoose,
          })),
          key: 'filter header',
        },
      ]
    } else {
      // width is different from cached and we don't have a filter
      // calculate sections and cache for next time
      sections = emojiSections.map(c => ({
        category: c.category,
        data: chunk(c.data.emojis, emojisPerLine).map(c => ({
          emojis: c,
          key: c[0].short_name,
          onChoose: this.props.onChoose,
        })),
        key: c.key,
      }))
      this._cacheSections(this.props.width, sections)
    }
    this.setState({sections})
  }

  _cacheSections = (width: number, sections: Array<Section>) => {
    cachedWidth = width
    cachedSections = sections
  }

  componentDidMount() {
    this._chunkData()
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.filter !== prevProps.filter || this.props.width !== prevProps.width) {
      this._chunkData()
    }
  }

  render() {
    return this.state.sections ? (
      <SectionList
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        sections={this.state.sections}
        stickySectionHeadersEnabled={true}
        renderItem={EmojiRow}
        renderSectionHeader={HeaderRow}
      />
    ) : null
  }
}

const EmojiRow = ({item}: {item: {emojis: Array<EmojiData>, onChoose: EmojiData => void, key: string}}) => (
  <Box2 key={item.key} fullWidth={true} style={styles.alignItemsCenter} direction="horizontal">
    {item.emojis.map(e => (
      <ClickableBox onClick={() => item.onChoose(e)} style={styles.emoji} key={e.short_name}>
        <Emoji size={singleEmojiWidth} emojiName={`:${e.short_name}:`} />
      </ClickableBox>
    ))}
  </Box2>
)

const HeaderRow = ({section}: {section: Section}) => (
  <Box2 direction="horizontal" fullWidth={true} style={styles.sectionHeader}>
    <Text type="BodySmallSemibold">{section.category}</Text>
  </Box2>
)

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
