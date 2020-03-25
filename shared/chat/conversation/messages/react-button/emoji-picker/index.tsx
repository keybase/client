import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import * as Data from './data'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {isMobile} from '../../../../../constants/platform'
import chunk from 'lodash/chunk'
import {memoize} from '../../../../../util/memoize'
import {Section as _Section} from '../../../../../common-adapters/section-list'
import * as RPCChatGen from '../../../../../constants/types/rpc-chat-gen'

// defer loading this until we need to, very expensive
const _getData = memoize(() => {
  const categories: typeof Data.categories = require('./data').categories
  const emojiIndex: typeof Data.emojiIndex = require('./data').emojiIndex
  const emojiNameMap: typeof Data.emojiNameMap = require('./data').emojiNameMap
  const emojiSkinTones: typeof Data.skinTones = require('./data').skinTones
  return {categories, emojiIndex, emojiNameMap, emojiSkinTones}
})

// type EmojiCategory = {category: string; emojis: Array<Data.EmojiData>}
const getData = memoize((topReacjis: Array<string>) => {
  const {categories, emojiIndex, emojiNameMap} = _getData()

  // SectionList data is mostly static, map categories here
  // and chunk data within component
  const emojiSections = categories.map(c => ({
    data: {emojis: c.emojis, key: ''},
    key: c.category,
    title: c.category,
  }))

  const frequentSection = {
    data: {
      emojis: topReacjis.map(shortName => emojiNameMap[shortName.replace(/:/g, '')]).slice(0, 3),
    },
    key: 'Frequently Used',
    title: 'Frequently Used',
  }

  // Get emoji results for a query and map
  // to full emoji data
  const getFilterResults = (filter: string): Array<Data.EmojiData> =>
    emojiIndex
      // @ts-ignore type wrong?
      .search(filter, {maxResults: maxEmojiSearchResults})
      .map((res: {id: string}) => emojiNameMap[res.id])
      // MUST sort this so its stable
      .sort((a: any, b: any) => a.sort_order - b.sort_order)

  return {
    emojiIndex,
    emojiSections,
    frequentSection,
    getFilterResults,
  }
})

const singleEmojiWidth = isMobile ? 32 : 26
const emojiPadding = 5
const emojiWidthWithPadding = singleEmojiWidth + 2 * emojiPadding
const maxEmojiSearchResults = 50

// Usually this emoji picker will be full-width on mobile
// Cache the width & sections after the first render so we
// can render a good initial guess
let cachedWidth = 0
let cachedSections: Array<Section> = []
let cachedTopReacjis: Array<String> | null = null
const cacheSections = (width: number, sections: Array<Section>, topReacjis: Array<string> | null) => {
  cachedWidth = width
  cachedSections = sections
  cachedTopReacjis = topReacjis
}

type Item = {emojis: Array<Data.EmojiData>; key: string}
type Section = _Section<Item, {title?: string}>

type Props = {
  topReacjis: Array<string>
  filter?: string
  onChoose: (emojiStr: string) => void
  onHover?: (emoji: Data.EmojiData) => void
  skinTone?: Types.EmojiSkinTone
  customSections?: RPCChatGen.EmojiGroup[]
  width: number
  waitingForEmoji?: boolean
}

type State = {
  sections: Array<Section> | null
}

class EmojiPicker extends React.Component<Props, State> {
  state = {sections: cachedSections}

  private getEmojisPerLine = () => this.props.width && Math.floor(this.props.width / emojiWidthWithPadding)
  private chunkData = (force: boolean) => {
    if (!this.props.width) {
      // Nothing to do if we don't have a width
      return
    }
    if (!force && this.props.width === cachedWidth && this.props.topReacjis === cachedTopReacjis) {
      this.setState(s => (s.sections === cachedSections ? null : {sections: cachedSections}))
      return
    }

    const emojisPerLine = this.getEmojisPerLine()
    const {emojiSections, frequentSection} = getData(this.props.topReacjis.slice(0, emojisPerLine * 4))
    // width is different from cached. make new sections & cache for next time
    let sections: Array<Section> = []
    if (!!this.props.topReacjis && this.props.topReacjis.length) {
      sections.push({
        data: chunk(frequentSection.data.emojis, emojisPerLine).map((c: any, idx: number) => ({
          emojis: c,
          key: (c && c.length && c[0] && c[0].short_name) || String(idx),
        })),
        key: frequentSection.key,
        title: frequentSection.title,
      })
    }
    this.props.customSections?.map(c =>
      sections.push({
        data: [
          {
            emojis:
              c.emojis?.map(e => ({
                category: c.name,
                name: null,
                short_name: e.alias,
                short_names: [e.alias],
                source: e.source.httpsrv,
                unified: '',
              })) ?? [],
            key: '',
          },
        ],
        key: c.name,
        title: c.name,
      })
    )

    emojiSections.map(c =>
      sections.push({
        data: chunk(c.data.emojis, emojisPerLine).map((c: any, idx: number) => ({
          emojis: c,
          key: (c && c.length && c[0] && c[0].short_name) || String(idx),
        })),
        key: c.key,
        title: c.title,
      })
    )
    cacheSections(this.props.width, sections, this.props.topReacjis)
    this.setState({sections})
  }

  componentDidMount() {
    if (this.props.width) {
      this.chunkData(false)
    }
  }

  componentDidUpdate(prevProps: Props) {
    const customChanged = this.props.customSections !== prevProps.customSections
    if (
      this.props.width !== prevProps.width ||
      this.props.topReacjis !== prevProps.topReacjis ||
      customChanged
    ) {
      this.chunkData(customChanged)
    }
  }

  private getEmojiSingle = (emoji: Data.EmojiData, skinTone?: Types.EmojiSkinTone) => {
    const emojiStr = addSkinToneIfAvailable(emoji, skinTone)
    return (
      <Kb.ClickableBox
        onClick={() => this.props.onChoose(emojiStr)}
        onMouseOver={this.props.onHover && (() => this.props.onHover?.(emoji))}
        style={styles.emoji}
        key={emoji.short_name}
      >
        {emoji.source ? (
          <Kb.CustomEmoji size="Medium" src={emoji.source} alias={emoji.short_name} />
        ) : (
          <Kb.Emoji size={singleEmojiWidth} emojiName={emojiStr} />
        )}
      </Kb.ClickableBox>
    )
  }

  private getEmojiRow = (item: Item, emojisPerLine: number) =>
    // This is possible when we have the cached sections, and we just got mounted
    // and haven't received width yet.
    item.emojis.length > emojisPerLine ? null : (
      <Kb.Box2 key={item.key} fullWidth={true} style={styles.emojiRowContainer} direction="horizontal">
        {item.emojis.map(e => this.getEmojiSingle(e, this.props.skinTone))}
        {[...Array(emojisPerLine - item.emojis.length)].map((_, index) => makeEmojiPlaceholder(index))}
      </Kb.Box2>
    )

  render() {
    const emojisPerLine = this.getEmojisPerLine()
    const {getFilterResults} = getData(this.props.topReacjis)
    // For filtered results, we have <= `maxEmojiSearchResults` emojis
    // to render. Render them directly rather than going through chunkData
    // pipeline for fast list of results. Go through chunkData only
    // when the width changes to do that processing as infrequently as possible
    if (this.props.waitingForEmoji) {
      return (
        <Kb.Box2 direction="horizontal" style={Styles.collapseStyles([styles.flexWrap])}>
          <Kb.ProgressIndicator />
        </Kb.Box2>
      )
    }
    if (this.props.filter) {
      const results = getFilterResults(this.props.filter)
      // NOTE: maxEmojiSearchResults = 50 currently. this never fills the screen
      // (on iPhone 5S)
      // so I'm not adding a ScrollView here. If we increase that later check
      // if this can sometimes overflow the screen here & add a ScrollView
      return (
        <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true}>
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            style={Styles.collapseStyles([styles.emojiRowContainer, styles.flexWrap])}
          >
            {results.map(e => this.getEmojiSingle(e, this.props.skinTone))}
            {[...Array(emojisPerLine - (results.length % emojisPerLine))].map((_, index) =>
              makeEmojiPlaceholder(index)
            )}
          </Kb.Box2>
        </Kb.Box2>
      )
    }
    // !this.state.sections means we haven't cached any sections yet
    // i.e. we haven't rendered before. let sections be calculated first
    return this.state.sections ? (
      <Kb.SectionList
        desktopItemHeight={36}
        desktopHeaderHeight={32}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        sections={this.state.sections}
        stickySectionHeadersEnabled={Styles.isMobile}
        renderItem={({item}: {item: Item; index: number}) => this.getEmojiRow(item, emojisPerLine)}
        renderSectionHeader={HeaderRow}
      />
    ) : null
  }
}

export const addSkinToneIfAvailable = (emoji: Data.EmojiData, skinTone?: Types.EmojiSkinTone) =>
  skinTone && emoji.skin_variations?.[skinTone]
    ? `:${emoji.short_name}::${_getData().emojiSkinTones.get(skinTone)?.short_name}:`
    : `:${emoji.short_name}:`

const makeEmojiPlaceholder = (index: number) => (
  <Kb.Box key={`ph-${index.toString()}`} style={styles.emojiPlaceholder} />
)

const HeaderRow = ({section}: {section: Section}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.sectionHeader}>
    <Kb.Text type="BodySmallSemibold">{section.title}</Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      emoji: {
        padding: emojiPadding,
        width: emojiWidthWithPadding,
      },
      emojiPlaceholder: {
        width: emojiWidthWithPadding,
      },
      emojiRowContainer: {
        alignItems: 'center',
        justifyContent: 'center',
      },
      flexWrap: {
        flexWrap: 'wrap',
      },
      sectionHeader: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.white,
        height: 32,
        paddingLeft: Styles.globalMargins.tiny,
      },
    } as const)
)

export default EmojiPicker
