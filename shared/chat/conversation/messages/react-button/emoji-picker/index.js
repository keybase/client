// @flow
import * as React from 'react'
import {categories, emojiIndex, emojiNameMap, type EmojiData} from './data'
import {ClickableBox, Box2, Emoji, SectionList, Text} from '../../../../../common-adapters'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate} from '../../../../../styles'
import {isAndroid} from '../../../../../constants/platform'
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
const emojiWidthWithPadding = singleEmojiWidth + 2 * emojiPadding
const maxEmojiSearchResults = 50

// Usually this emoji picker will be full-width on mobile
// Cache the width & sections after the first render so we
// can render a good initial guess
let cachedWidth = 0
let cachedSections = null
const cacheSections = (width: number, sections: Array<Section>) => {
  cachedWidth = width
  cachedSections = sections
}

// Get emoji results for a query and map
// to full emoji data
const getFilterResults = filter => {
  return emojiIndex.search(filter, {maxResults: maxEmojiSearchResults}).map(res => emojiNameMap[res.id])
}

type Section = {
  category: string,
  data: Array<{emojis: Array<EmojiData>, key: string}>,
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
      // Nothing to do if we don't have a width
      return
    }
    if (this.props.width === cachedWidth) {
      this.setState(s => (s.sections === cachedSections ? null : {sections: cachedSections}))
      return
    }
    // width is different from cached. make new sections & cache for next time
    let sections = []
    const emojisPerLine = Math.floor(this.props.width / emojiWidthWithPadding)
    sections = emojiSections.map(c => ({
      category: c.category,
      data: chunk(c.data.emojis, emojisPerLine).map(c => ({
        emojis: c,
        key: c[0].short_name,
      })),
      key: c.key,
    }))
    cacheSections(this.props.width, sections)
    this.setState({sections})
  }

  componentDidMount() {
    if (this.props.width) {
      this._chunkData()
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.width !== prevProps.width) {
      this._chunkData()
    }
  }

  render() {
    // For filtered results, we have <= `maxEmojiSearchResults` emojis
    // to render. Render them directly rather than going through _chunkData
    // pipeline for fast list of results. Go through _chunkData only
    // when the width changes to do that processing as infrequently as possible
    if (this.props.filter) {
      const results = getFilterResults(this.props.filter)
      // NOTE: maxEmojiSearchResults = 50 currently. this never fills the screen
      // (on iPhone 5S)
      // so I'm not adding a ScrollView here. If we increase that later check
      // if this can sometimes overflow the screen here & add a ScrollView
      const width = this.props.width
        ? Math.floor(this.props.width / emojiWidthWithPadding) * emojiWidthWithPadding
        : null
      return (
        <Box2
          direction="horizontal"
          style={collapseStyles([styles.alignItemsCenter, styles.flexWrap, !!width && {width}])}
        >
          {results.map(e => <EmojiRender key={e.short_name} emoji={e} onChoose={this.props.onChoose} />)}
        </Box2>
      )
    }
    // !this.state.sections means we haven't cached any sections yet
    // i.e. we haven't rendered before. let sections be calculated first
    return this.state.sections ? (
      <SectionList
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        sections={this.state.sections}
        stickySectionHeadersEnabled={true}
        renderItem={item => <EmojiRow key={item.index} {...item} onChoose={this.props.onChoose} />}
        renderSectionHeader={HeaderRow}
      />
    ) : null
  }
}

const EmojiRow = (props: {item: {emojis: Array<EmojiData>, key: string}, onChoose: EmojiData => void}) => (
  <Box2 key={props.item.key} fullWidth={true} style={styles.alignItemsCenter} direction="horizontal">
    {props.item.emojis.map(e => <EmojiRender key={e.short_name} emoji={e} onChoose={props.onChoose} />)}
  </Box2>
)

const EmojiRender = ({emoji, onChoose}: {emoji: EmojiData, onChoose: EmojiData => void}) => (
  <ClickableBox onClick={() => onChoose(emoji)} style={styles.emoji} key={emoji.short_name}>
    <Emoji size={isAndroid ? singleEmojiWidth - 5 : singleEmojiWidth} emojiName={`:${emoji.short_name}:`} />
  </ClickableBox>
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
    width: emojiWidthWithPadding,
  },
  flexWrap: {
    flexWrap: 'wrap',
  },
  sectionHeader: {
    alignItems: 'center',
    backgroundColor: globalColors.white,
    height: 32,
    paddingLeft: globalMargins.tiny,
  },
})

export default EmojiPicker
