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
const _getData = () => {
  const categories: typeof Data.categories = require('./data').categories
  const emojiIndex: typeof Data.emojiIndex = require('./data').emojiIndex
  const emojiNameMap: typeof Data.emojiNameMap = require('./data').emojiNameMap
  const emojiSkinTones: typeof Data.skinTones = require('./data').skinTones
  return {categories, emojiIndex, emojiNameMap, emojiSkinTones}
}

const chunkEmojis = (emojis: Array<Data.EmojiData>, emojisPerLine: number): Array<Row> =>
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
  (topReacjis: Array<string>, emojisPerLine): Section => {
    const {emojiNameMap} = _getData()
    const emojis = topReacjis.reduce<Array<Data.EmojiData>>((arr, shortName) => {
      const emoji = emojiNameMap[shortName.replace(/:/g, '')]
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

type Row = {emojis: Array<Data.EmojiData>; key: string}
type Section = _Section<Row, {title: string}>

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
  activeSectionIndex: number
}

type Bookmark = {
  coveredSectionIndices?: Set<number>
  iconType: Kb.IconType
  sectionIndex: number
}

const emojiGroupsToEmojiArrayArray = (
  emojiGroups: Array<RPCChatGen.EmojiGroup>
): Array<{emojis: Array<Data.EmojiData>; name: string}> =>
  emojiGroups.map(emojiGroup => ({
    emojis:
      emojiGroup.emojis
        ?.map(e =>
          e.source.typ === RPCChatGen.EmojiLoadSourceTyp.str
            ? {
                category: emojiGroup.name,
                name: null,
                short_name: e.source.str,
                short_names: [e.source.str, e.alias],
                unified: '',
              }
            : {
                category: emojiGroup.name,
                name: null,
                short_name: e.alias,
                short_names: [e.alias],
                source: e.source.httpsrv,
                unified: '',
              }
        )
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
  const mapper = new Map<string, Data.EmojiData>()
  emojiGroupsToEmojiArrayArray(emojiGroups).forEach(emojiGroup =>
    emojiGroup.emojis.forEach(emoji => {
      mapper.set(emoji.short_name, emoji)
    })
  )
  const keys = [...mapper.keys()]
  // This is gonna be slow, but is probably fine until we have too many custom
  // emojis. We should switch to a prefix tree and maybe move this to Go side
  // at that point.
  return (filter: string): Array<Data.EmojiData> =>
    // @ts-ignore ts doesn't know Boolean filters out undefined.
    keys
      .filter(k => k.includes(filter))
      .map(key => mapper.get(key))
      .filter(Boolean)
})

const getResultFilter = (emojiGroups?: Array<RPCChatGen.EmojiGroup>) => {
  const {emojiIndex, emojiNameMap} = _getData()
  const customEmojiIndex = emojiGroups ? getCustomEmojiIndex(emojiGroups) : () => []
  return (filter: string): Array<Data.EmojiData> => {
    return [
      ...customEmojiIndex(filter),
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
    bookmarks.push({iconType: 'iconfont-clock', sectionIndex: sections.length})
    sections.push(getFrequentSection(topReacjis, emojisPerLine))
  }

  if (customSections?.length) {
    const bookmark = {
      coveredSectionIndices: new Set<number>(),
      iconType: 'iconfont-keybase',
      sectionIndex: sections.length,
    } as Bookmark
    getCustomEmojiSections(customSections, emojisPerLine).forEach(section => {
      bookmark.coveredSectionIndices?.add(sections.length)
      sections.push(section)
    })
    bookmarks.push(bookmark)
  }

  getEmojiSections(emojisPerLine).forEach(section => {
    const categoryIcon = Data.categoryIcons[section.title]
    categoryIcon && bookmarks.push({iconType: categoryIcon, sectionIndex: sections.length})
    sections.push(section)
  })

  return {bookmarks, sections}
}

class EmojiPicker extends React.PureComponent<Props, State> {
  state = {activeSectionIndex: 0}

  private mounted = true
  componentWillUnmount() {
    this.mounted = false
  }

  private getEmojiSingle = (emoji: Data.EmojiData, skinTone?: Types.EmojiSkinTone) => {
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

  private getBookmarkBar = (bookmarks: Array<Bookmark>) =>
    Styles.isMobile ? null : (
      <Kb.Box2 direction="horizontal" style={styles.bookmarkContainer}>
        {bookmarks.map(bookmark => {
          const isActive =
            this.state.activeSectionIndex === bookmark.sectionIndex ||
            bookmark.coveredSectionIndices?.has(this.state.activeSectionIndex)
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
                  this.sectionListRef.current?.scrollToLocation({sectionIndex: bookmark.sectionIndex})
                }
              />
            </Kb.Box>
          )
        })}
      </Kb.Box2>
    )

  private getSectionHeader = (title: string) => (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.sectionHeader}>
      <Kb.Text type="BodySmallSemibold">{title}</Kb.Text>
    </Kb.Box2>
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
        <Kb.SectionList
          ref={this.sectionListRef}
          desktopItemHeight={36}
          desktopHeaderHeight={32}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={14}
          sections={sections}
          desktopOnSectionChange={sectionIndex =>
            this.mounted && this.setState({activeSectionIndex: sectionIndex})
          }
          stickySectionHeadersEnabled={Styles.isMobile}
          renderItem={({item}: {item: Row; index: number}) => this.getEmojiRow(item, emojisPerLine)}
          renderSectionHeader={({section}) => this.getSectionHeader(section.title)}
        />
      </>
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
