import * as React from 'react'
import type * as Types from './../../constants/types/chat2'
import type * as RPCTypes from './../../constants/types/rpc-gen'
import * as Data from './../../util/emoji'
import * as Kb from './../../common-adapters'
import * as Styles from './../../styles'
import debounce from 'lodash/debounce'
import {isMobile} from './../../constants/platform'
import chunk from 'lodash/chunk'
import {memoize} from './../../util/memoize'
import {
  emojiDataToRenderableEmoji,
  getEmojiStr,
  renderEmoji,
  type EmojiData,
  type RenderableEmoji,
  RPCToEmojiData,
} from './../../util/emoji'
import type {Section as _Section} from './../../common-adapters/section-list'
import type * as RPCChatGen from './../../constants/types/rpc-chat-gen'

// defer loading this until we need to, very expensive
const _getData = () => {
  const categories = require('../../util/emoji').categories as typeof Data.categories
  const emojiSearch = require('../../util/emoji').emojiSearch as typeof Data.emojiSearch
  const emojiNameMap = require('../../util/emoji').emojiNameMap as typeof Data.emojiNameMap
  const emojiSkinTones = require('../../util/emoji').skinTones as typeof Data.skinTones
  return {categories, emojiNameMap, emojiSearch, emojiSkinTones}
}

const chunkEmojis = (emojis: Array<EmojiData>, emojisPerLine: number): Array<Row> =>
  chunk(emojis, emojisPerLine).map((c: any, idx: number) => ({
    emojis: c,
    key: (c && c.length && c[0] && c[0].short_name) || String(idx),
  }))

// Remove those that have been obsolete and have a replacement. But it doens't
// cover cases like :man-facepalming: vs :face_palm: even though they look
// same.
const removeObsolete = (emojis: Array<EmojiData>) => emojis.filter(e => !e.obsoleted_by)

const getEmojiSections = memoize(
  (emojisPerLine: number): Array<Section> =>
    _getData().categories.map(c => ({
      data: chunkEmojis(removeObsolete(c.emojis), emojisPerLine),
      key: c.category,
      title: c.category,
    }))
)

const getFrequentSection = memoize(
  (
    topReacjis: Array<RPCTypes.UserReacji>,
    customEmojiGroups: Array<RPCChatGen.EmojiGroup>,
    emojisPerLine: number
  ): Section => {
    const {emojiNameMap} = _getData()
    const customEmojiIndex = getCustomEmojiIndex(customEmojiGroups)
    const emojis = topReacjis.reduce<Array<EmojiData>>((arr, top) => {
      const shortNameNoColons = top.name.replace(/:/g, '')
      const emoji = emojiNameMap[shortNameNoColons] || customEmojiIndex.get(shortNameNoColons)
      if (emoji) {
        arr.push(emoji)
      }
      return arr
    }, [])
    return {
      data: chunkEmojis(emojis, emojisPerLine).slice(0, 4),
      key: 'Frequently Used',
      title: 'Frequently used',
    }
  }
)

const singleEmojiWidth = isMobile ? 32 : 26
const emojiPadding = 5
const emojiWidthWithPadding = singleEmojiWidth + 2 * emojiPadding
const maxEmojiSearchResults = 50
const notFoundHeight = 224

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
  addEmoji: () => void
  topReacjis: Array<RPCTypes.UserReacji>
  filter?: string
  hideFrequentEmoji: boolean
  onChoose: (emojiStr: string, renderableEmoji: RenderableEmoji) => void
  onHover?: (emoji: EmojiData) => void
  skinTone?: Types.EmojiSkinTone
  customEmojiGroups?: RPCChatGen.EmojiGroup[]
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
        ?.map(e => RPCToEmojiData(e, false))
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
  const {emojiSearch} = _getData()
  const customEmojiIndex = emojiGroups ? getCustomEmojiIndex(emojiGroups) : emptyCustomEmojiIndex
  return (filter: string): Array<EmojiData> => {
    return [...customEmojiIndex.filter(filter), ...removeObsolete(emojiSearch(filter, maxEmojiSearchResults))]
  }
}

const getEmojisPerLine = (width: number) => width && Math.floor(width / emojiWidthWithPadding)

const getSectionsAndBookmarks = memoize(
  (
    width: number,
    topReacjis: Array<RPCTypes.UserReacji>,
    hideTopReacjis: boolean,
    customEmojiGroups?: RPCChatGen.EmojiGroup[]
  ) => {
    if (!width) {
      return {bookmarks: [], sections: []}
    }

    const emojisPerLine = getEmojisPerLine(width)
    const sections: Array<Section> = []
    const bookmarks: Array<Bookmark> = []

    if (topReacjis.length && !hideTopReacjis) {
      const frequentSection = getFrequentSection(topReacjis, customEmojiGroups || emptyArray, emojisPerLine)
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

    if (customEmojiGroups?.length) {
      const bookmark = {
        coveredSectionKeys: new Set<string>(),
        iconType: 'iconfont-keybase',
        sectionIndex: sections.length,
      } as Bookmark
      getCustomEmojiSections(customEmojiGroups, emojisPerLine).forEach(section => {
        bookmark.coveredSectionKeys.add(section.key)
        sections.push(section)
      })
      bookmarks.push(bookmark)
    }

    sections.push({
      data: [],
      key: 'not-found',
      title: 'not-found',
    })

    return {bookmarks, sections}
  }
)

const EmojiRow = React.memo(function EmojiRow(p: {
  row: Row
  emojisPerLine: number
  mapper: (e: Row['emojis'][number]) => React.ReactNode
}) {
  const {row, emojisPerLine, mapper} = p
  return (
    <Kb.Box2 key={row.key} fullWidth={true} style={styles.emojiRowContainer} direction="horizontal">
      {row.emojis.map(mapper)}
      {[...Array(emojisPerLine - row.emojis.length)].map((_, index) => makeEmojiPlaceholder(index))}
    </Kb.Box2>
  )
})

class EmojiPicker extends React.PureComponent<Props, State> {
  state = {activeSectionKey: ''}

  private mounted = true
  componentWillUnmount() {
    this.mounted = false
  }

  private getEmojiSingle = (emoji: EmojiData, skinTone?: Types.EmojiSkinTone) => {
    const skinToneModifier = getSkinToneModifierStrIfAvailable(emoji, skinTone)
    const renderable = emojiDataToRenderableEmoji(emoji, skinToneModifier, skinTone)
    return (
      <Kb.ClickableBox2
        className="emoji-picker-emoji-box"
        onClick={() => this.props.onChoose(getEmojiStr(emoji, skinToneModifier), renderable)}
        onMouseOver={this.props.onHover && (() => this.props.onHover?.(emoji))}
        style={styles.emoji}
        key={emoji.short_name}
      >
        {renderEmoji({emoji: renderable, showTooltip: false, size: singleEmojiWidth})}
      </Kb.ClickableBox2>
    )
  }

  private mapper = (e: Row['emojis'][number]) => this.getEmojiSingle(e, this.props.skinTone)
  private getEmojiRow = (row: Row, emojisPerLine: number) =>
    // This is possible when we have the cached sections, and we just got mounted
    // and haven't received width yet.
    row.emojis.length > emojisPerLine ? null : (
      <EmojiRow row={row} emojisPerLine={emojisPerLine} mapper={this.mapper} />
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

  private makeNotFound = () => (
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.notFoundContainer}>
      <Kb.Icon type="icon-empty-emoji-126-96" />
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
        <Kb.Text type="BodySmall" center={true}>
          Still haven’t found what you’re
        </Kb.Text>
        <Kb.Text type="BodySmall" center={true}>
          looking for?
        </Kb.Text>
      </Kb.Box2>
      <Kb.Button mode="Secondary" label="Add custom emoji" small={true} onClick={this.props.addEmoji} />
    </Kb.Box2>
  )

  private getEmojiWidthWithPadding = () => {
    return emojiWidthWithPadding
  }

  _sections = new Array<Section>()
  private getSectionHeaderHeight = (sectionIndex: number) => {
    return this._sections[sectionIndex].key === 'not-found' ? notFoundHeight : 32
  }

  _emojisPerLine = 1
  private renderItem = ({item}: {item: Row; index: number}) => this.getEmojiRow(item, this._emojisPerLine)

  private renderSectionHeader = ({section}) => {
    return section.key === 'not-found' ? this.makeNotFound() : this.getSectionHeader(section.title)
  }

  render() {
    const {bookmarks, sections} = getSectionsAndBookmarks(
      this.props.width,
      this.props.topReacjis,
      this.props.hideFrequentEmoji,
      this.props.customEmojiGroups
    )
    this._sections = sections
    const emojisPerLine = getEmojisPerLine(this.props.width)
    this._emojisPerLine = emojisPerLine
    const getFilterResults = getResultFilter(this.props.customEmojiGroups)
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
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          centerChildren={true}
          alignItems="flex-start"
          style={{...Styles.globalStyles.flexGrow, overflow: 'hidden'}}
        >
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
            {this.makeNotFound()}
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
            getItemHeight={this.getEmojiWidthWithPadding}
            getSectionHeaderHeight={this.getSectionHeaderHeight}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={14}
            sections={sections}
            onSectionChange={this.onSectionChange}
            stickySectionHeadersEnabled={true}
            renderItem={this.renderItem}
            renderSectionHeader={this.renderSectionHeader}
          />
        </Kb.Box2>
      </>
    ) : null
  }
}

export const getSkinToneModifierStrIfAvailable = (emoji: EmojiData, skinTone?: Types.EmojiSkinTone) => {
  if (skinTone && emoji.skin_variations?.[skinTone]) {
    const {emojiSkinTones} = _getData()
    const idx = emojiSkinTones.indexOf(skinTone)
    return `:skin-tone-${idx + 1}:`
  }
  return undefined
}

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
        height: 44,
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.tiny,
      },
      bookmarkScrollView: {
        flexShrink: 0,
      },
      emoji: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        borderRadius: 2,
        height: emojiWidthWithPadding,
        justifyContent: 'center',
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
      notFoundContainer: {
        height: notFoundHeight,
        justifyContent: 'space-between',
        ...Styles.padding(Styles.globalMargins.medium, 0),
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
