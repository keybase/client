import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import * as Data from './data'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {isMobile} from '../../../../../constants/platform'
import chunk from 'lodash/chunk'
import debounce from 'lodash/debounce'
import {memoize} from '../../../../../util/memoize'
import {EmojiData, RPCToEmojiData} from '../../../../../util/emoji'
import {Section as _Section} from '../../../../../common-adapters/section-list'
import * as RPCChatGen from '../../../../../constants/types/rpc-chat-gen'

// defer loading this until we need to, very expensive
const _getData = () => {
  const categories: typeof Data.categories = require('./data').categories
  const emojiIndex: typeof Data.emojiIndex = require('./data').emojiIndex
  const emojiNameMap: typeof Data.emojiNameMap = require('./data').emojiNameMap
  const emojiSkinTones: typeof Data.skinTones = require('./data').skinTones
  return {categories, emojiIndex, emojiNameMap, emojiSkinTones}
}

const chunkEmojis = (emojis: Array<EmojiData>, emojisPerLine: number): Array<Row> =>
  chunk(emojis, emojisPerLine).map((c: any, idx: number) => ({
    emojis: c,
    key: (c && c.length && c[0] && c[0].short_name) || String(idx),
  }))

const getEmojiSections = memoize(
  (emojisPerLine: number): Array<Section> =>
    _getData().categories.map(c => ({
      data: chunkEmojis(c.emojis, emojisPerLine),
      key: c.category,
      title: c.category,
    }))
)

const getFrequentSection = memoize(
  (
    topReacjis: Array<string>,
    customEmojiGroups: Array<RPCChatGen.EmojiGroup>,
    emojisPerLine: number
  ): Section => {
    const {emojiNameMap} = _getData()
    const customEmojiIndex = getCustomEmojiIndex(customEmojiGroups)
    const emojis = topReacjis.reduce<Array<EmojiData>>((arr, shortName) => {
      const shortNameNoColons = shortName.replace(/:/g, '')
      const emoji = emojiNameMap[shortNameNoColons] || customEmojiIndex.get(shortNameNoColons)
      if (emoji) {
        arr.push(emoji)
      }
      return arr
    }, [])
    return {
      data: chunkEmojis(emojis, emojisPerLine).slice(0, 4),
      key: 'Frequently Used',
      title: 'Frequently Used',
    }
  }
)

const singleEmojiWidth = isMobile ? 32 : 26
const emojiPadding = 5
const emojiWidthWithPadding = singleEmojiWidth + 2 * emojiPadding
const maxEmojiSearchResults = 50

type Row = {emojis: Array<EmojiData>; key: string}
type Section = _Section<
  Row,
  {
    // enforce string keys so we can easily refernece it for coveredSectionKeys
    key: string
    title: string
  }
>

type Props = {
  topReacjis: Array<string>
  filter?: string
  onChoose: (emojiStr: string) => void
  onHover?: (emoji: EmojiData) => void
  skinTone?: Types.EmojiSkinTone
  customSections?: RPCChatGen.EmojiGroup[]
  width: number
  waitingForEmoji?: boolean
}

type State = {
  activeSectionKey: string
}

type Bookmark = {
  coveredSectionKeys: Set<string>
  iconType: Kb.IconType
  sectionIndex: number
}

const emojiGroupsToEmojiArrayArray = (
  emojiGroups: Array<RPCChatGen.EmojiGroup>
): Array<{emojis: Array<EmojiData>; name: string}> =>
  emojiGroups.map(emojiGroup => ({
    emojis:
      emojiGroup.emojis
        ?.map(e => RPCToEmojiData(e))
        .sort((a, b) => a.short_name.localeCompare(b.short_name)) || [],
    name: emojiGroup.name,
  }))

const getCustomEmojiSections = memoize(
  (emojiGroups: Array<RPCChatGen.EmojiGroup>, emojisPerLine: number): Array<Section> =>
    emojiGroupsToEmojiArrayArray(emojiGroups).map(group => ({
      data: chunkEmojis(group.emojis, emojisPerLine),
      key: group.name,
      title: group.name,
    })) || []
)

const getCustomEmojiIndex = memoize((emojiGroups: Array<RPCChatGen.EmojiGroup>) => {
  const mapper = new Map<string, EmojiData>()
  emojiGroupsToEmojiArrayArray(emojiGroups).forEach(emojiGroup =>
    emojiGroup.emojis.forEach(emoji => {
      mapper.set(emoji.short_name, emoji)
    })
  )
  const keys = [...mapper.keys()]
  // This is gonna be slow, but is probably fine until we have too many custom
  // emojis. We should switch to a prefix tree and maybe move this to Go side
  // at that point.
  return {
    filter: (filter: string): Array<EmojiData> =>
      // @ts-ignore ts doesn't know Boolean filters out undefined.
      keys
        .filter(k => k.includes(filter))
        .map(key => mapper.get(key))
        .filter(Boolean),
    get: (shortName: string): EmojiData | undefined => mapper.get(shortName),
  }
})
const emptyCustomEmojiIndex = {filter: () => [], get: () => undefined}

const getResultFilter = (emojiGroups?: Array<RPCChatGen.EmojiGroup>) => {
  const {emojiIndex, emojiNameMap} = _getData()
  const customEmojiIndex = emojiGroups ? getCustomEmojiIndex(emojiGroups) : emptyCustomEmojiIndex
  return (filter: string): Array<EmojiData> => {
    return [
      ...customEmojiIndex.filter(filter),
      ...emojiIndex
        // @ts-ignore type wrong?
        .search(filter, {maxResults: maxEmojiSearchResults})
        .map((res: {id: string}) => emojiNameMap[res.id])
        // MUST sort this so its stable
        .sort((a: any, b: any) => a.sort_order - b.sort_order),
    ]
  }
}

const getEmojisPerLine = (width: number) => width && Math.floor(width / emojiWidthWithPadding)

const getSectionsAndBookmarks = (
  width: number,
  topReacjis: Array<string>,
  customSections?: RPCChatGen.EmojiGroup[]
) => {
  if (!width) {
    return {bookmarks: [], sections: []}
  }

  const emojisPerLine = getEmojisPerLine(width)
  const sections: Array<Section> = []
  const bookmarks: Array<Bookmark> = []

  if (topReacjis.length) {
    const frequentSection = getFrequentSection(topReacjis, customSections || emptyArray, emojisPerLine)
    bookmarks.push({
      coveredSectionKeys: new Set([frequentSection.key]),
      iconType: 'iconfont-clock',
      sectionIndex: sections.length,
    })
    sections.push(frequentSection)
  }

  getEmojiSections(emojisPerLine).forEach(section => {
    const categoryIcon = Data.categoryIcons[section.title]
    categoryIcon &&
      bookmarks.push({
        coveredSectionKeys: new Set([section.key]),
        iconType: categoryIcon,
        sectionIndex: sections.length,
      })
    sections.push(section)
  })

  if (customSections?.length) {
    const bookmark = {
      coveredSectionKeys: new Set<string>(),
      iconType: 'iconfont-keybase',
      sectionIndex: sections.length,
    } as Bookmark
    getCustomEmojiSections(customSections, emojisPerLine).forEach(section => {
      bookmark.coveredSectionKeys.add(section.key)
      sections.push(section)
    })
    bookmarks.push(bookmark)
  }

  return {bookmarks, sections}
}

class EmojiPicker extends React.PureComponent<Props, State> {
  state = {activeSectionKey: ''}

  private mounted = true
  componentWillUnmount() {
    this.mounted = false
  }

  private getEmojiSingle = (emoji: EmojiData, skinTone?: Types.EmojiSkinTone) => {
    const emojiStr = addSkinToneIfAvailable(emoji, skinTone)
    return (
      <Kb.ClickableBox
        className="emoji-picker-emoji-box"
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

  private getEmojiRow = (row: Row, emojisPerLine: number) =>
    // This is possible when we have the cached sections, and we just got mounted
    // and haven't received width yet.
    row.emojis.length > emojisPerLine ? null : (
      <Kb.Box2 key={row.key} fullWidth={true} style={styles.emojiRowContainer} direction="horizontal">
        {row.emojis.map(e => this.getEmojiSingle(e, this.props.skinTone))}
        {[...Array(emojisPerLine - row.emojis.length)].map((_, index) => makeEmojiPlaceholder(index))}
      </Kb.Box2>
    )

  private sectionListRef = React.createRef<any>()

  private getBookmarkBar = (bookmarks: Array<Bookmark>) => {
    const content = (
      <Kb.Box2 key="bookmark" direction="horizontal" fullWidth={true} style={styles.bookmarkContainer}>
        {bookmarks.map((bookmark, bookmarkIndex) => {
          const isActive = this.state.activeSectionKey
            ? bookmark.coveredSectionKeys.has(this.state.activeSectionKey)
            : bookmarkIndex === 0
          return (
            <Kb.Box
              key={bookmark.sectionIndex}
              className="emoji-picker-emoji-box"
              style={isActive ? styles.activeBookmark : undefined}
            >
              <Kb.Icon
                type={bookmark.iconType}
                padding="tiny"
                color={isActive ? Styles.globalColors.blue : Styles.globalColors.black_50}
                onClick={() =>
                  this.sectionListRef.current?.scrollToLocation({
                    itemIndex: 0,
                    sectionIndex: bookmark.sectionIndex,
                  })
                }
              />
            </Kb.Box>
          )
        })}
      </Kb.Box2>
    )
    return Styles.isMobile ? (
      <Kb.ScrollView key="bookmark" horizontal={true} style={styles.bookmarkScrollView}>
        {content}
      </Kb.ScrollView>
    ) : (
      content
    )
  }

  private getSectionHeader = (title: string) => (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.sectionHeader}>
      <Kb.Text type="BodySmallSemibold">{title}</Kb.Text>
    </Kb.Box2>
  )

  private onSectionChange = debounce(
    section => this.mounted && this.setState({activeSectionKey: section.key}),
    200
  )

  render() {
    const {bookmarks, sections} = getSectionsAndBookmarks(
      this.props.width,
      this.props.topReacjis,
      this.props.customSections
    )
    const emojisPerLine = getEmojisPerLine(this.props.width)
    const getFilterResults = getResultFilter(this.props.customSections)
    // For filtered results, we have <= `maxEmojiSearchResults` emojis
    // to render. Render them directly rather than going through chunkData
    // pipeline for fast list of results. Go through chunkData only
    // when the width changes to do that processing as infrequently as possible
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
            {this.getSectionHeader('Search results')}
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
    return sections ? (
      <>
        {this.getBookmarkBar(bookmarks)}
        <Kb.Box2
          key="section-list-container"
          direction="vertical"
          fullWidth={true}
          style={styles.sectionListContainer}
        >
          <Kb.SectionList
            ref={this.sectionListRef}
            getItemHeight={() => emojiWidthWithPadding}
            getSectionHeaderHeight={() => 32}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={14}
            sections={sections}
            onSectionChange={this.onSectionChange}
            stickySectionHeadersEnabled={Styles.isMobile}
            renderItem={({item}: {item: Row; index: number}) => this.getEmojiRow(item, emojisPerLine)}
            renderSectionHeader={({section}) => this.getSectionHeader(section.title)}
          />
        </Kb.Box2>
      </>
    ) : null
  }
}

export const addSkinToneIfAvailable = (emoji: EmojiData, skinTone?: Types.EmojiSkinTone) =>
  skinTone && emoji.skin_variations?.[skinTone]
    ? `:${emoji.short_name}::${_getData().emojiSkinTones.get(skinTone)?.short_name}:`
    : `:${emoji.short_name}:`

const makeEmojiPlaceholder = (index: number) => (
  <Kb.Box key={`ph-${index.toString()}`} style={styles.emojiPlaceholder} />
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      activeBookmark: {
        backgroundColor: Styles.globalColors.blue_10,
      },
      bookmarkContainer: {
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.tiny,
      },
      bookmarkScrollView: {
        flexShrink: 0,
      },
      emoji: {
        borderRadius: 2,
        padding: emojiPadding,
        width: emojiWidthWithPadding,
      },
      emojiPlaceholder: {
        width: emojiWidthWithPadding,
      },
      emojiRowContainer: {
        alignItems: 'center',
        height: emojiWidthWithPadding,
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
      sectionListContainer: {
        flexGrow: 1,
        flexShrink: 1,
        overflow: 'hidden',
      },
    } as const)
)

export default EmojiPicker

const emptyArray = []
