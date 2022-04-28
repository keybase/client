import * as React from 'react'
import * as Styles from '../styles'
import * as ReactNative from 'react-native'

export type SectionListRenderItem<ItemT, ExtraT> = (info: {
  index: number
  item: ItemT
  section: Section<ItemT, ExtraT>
}) => React.ReactNode

/**
 * Section is the type for a section in a sectionlist. ItemT is the type of the
 * items, and ExtraT is for any extra stuff that is in the section, e.g. a title
 * used by renderSectionHeader
 */
export type Section<ItemT, ExtraT = {}> = {
  data: ReadonlyArray<ItemT>
  key?: React.Key
  renderItem?: SectionListRenderItem<ItemT, ExtraT>
  // There exist mobile-only keyExtractor and ItemSeparatorComponent here, not
  // included because I think they would create more confusion than usefulness
  // and a mobile-only situation can import the native sectionlist anyway.
} & ExtraT

type ItemTFromSectionT<SectionT> = SectionT extends Section<infer ItemT, infer _ExtraT> ? ItemT : SectionT
type ExtraTFromSectionT<SectionT> = SectionT extends Section<infer _ItemT, infer ExtraT> ? ExtraT : SectionT
// This type is missing a lot of features from the native sectionlist on purpose
// - if you need those in a mobile-only context, you should import the
// NativeSectionList instead. Otherwise, add them to this type.
export type Props<SectionT extends Section<any, any>> = {
  /**
   * An array of objects with data for each section.
   */
  sections: ReadonlyArray<SectionT>

  /**
   * Default renderer for every item in every section. Can be over-ridden on a
   * per-section basis.
   */
  renderItem?: SectionListRenderItem<ItemTFromSectionT<SectionT>, ExtraTFromSectionT<SectionT>>

  /**
   * Rendered at the top of each section. Sticky headers are not yet supported.
   */
  renderSectionHeader?: (info: {section: SectionT}) => React.ReactElement | null

  /**
   * Makes section headers stick to the top of the screen until the next one
   * pushes it off. Only enabled by default on iOS because that is the platform
   * standard there.
   */
  stickySectionHeadersEnabled?: boolean

  /**
   * Rendered at the very beginning of the list.
   */
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null

  /**
   * Used to extract a unique key for a given item at the specified index. Key
   * is used for caching and as the react key to track item re-ordering. The
   * default extractor checks `item.key`, then falls back to using the index,
   * like React does.
   */
  keyExtractor?: (item: ItemTFromSectionT<SectionT>, index: number) => React.Key

  /**
   * Called once when the scroll position gets within onEndReachedThreshold of
   * the rendered content.
   */
  onEndReached?: ((info: {distanceFromEnd: number}) => void) | null

  contentContainerStyle?: Styles.StylesCrossPlatform
  style?: Styles.StylesCrossPlatform

  /**
   * A marker property for telling the list to re-render (since it implements
   * PureComponent). If any of your `renderItem`, Header, Footer, etc. functions
   * depend on anything outside of the `data` prop, stick it here and treat it
   * immutably.
   */
  extraData?: any

  //////////////////////////////////////////////////////////////////////
  // Desktop-only props.
  /**
   * `selectedIndex` is used for SectionList with item selecting, where the
   * scroll should follow selected item.
   */
  selectedIndex?: number
  disableAbsoluteStickyHeader?: boolean
  sectionKeyExtractor?: (section: SectionT, sectionIndex: number) => React.Key

  /////////////////////////////////////////////////
  // Mobile-only props. TODO: consider changing this to a mobileOnlyProps:
  // Partial<NativeSectionListProps<ItemT>> instead (and adjusting
  // implementation accordingly)
  /**
   * Determines when the keyboard should stay visible after a tap.
   * - 'never' (the default), tapping outside of the focused text input when the
   *   keyboard is up dismisses the keyboard. When this happens, children won't
   *   receive the tap.
   * - 'always', the keyboard will not dismiss automatically, and the scroll
   *   view will not catch taps, but children of the scroll view can catch taps.
   * - 'handled', the keyboard will not dismiss automatically when the tap was
   *   handled by a children, (or captured by an ancestor).
   * - false, deprecated, use 'never' instead
   * - true, deprecated, use 'always' instead
   */
  keyboardShouldPersistTaps?: boolean | 'always' | 'never' | 'handled'

  keyboardDismissMode?: 'on-drag'
  scrollEventThrottle?: number

  getItemLayout?: (
    sections: Array<SectionT>,
    indexInList: number
  ) => {index: number; length: number; offset: number}

  /**
   * How many items to render in the initial batch
   */
  initialNumToRender?: number

  // iOS only
  alwaysBounceVertical?: boolean

  /**
   * Fires at most once per frame during scrolling. The frequency of the events
   * can be contolled using the scrollEventThrottle prop.
   */
  onScroll?: (event: ReactNative.NativeSyntheticEvent<ReactNative.NativeScrollEvent>) => void

  getItemHeight?: (
    item: ItemTFromSectionT<SectionT>,
    sectionIndex: number,
    indexWithinSection: number
  ) => number
  getSectionHeaderHeight?: (sectionIndex: number) => number

  onSectionChange?: (section: SectionT) => void

  desktopReactListTypeOverride?: string
  desktopItemSizeEstimatorOverride?: () => number
}

export default class<T extends Section<any, any>> extends React.Component<Props<T>> {
  getNode: () =>
    | {
        scrollToLocation: (o: {animated: boolean; itemIndex: number; sectionIndex: number}) => void
      }
    | undefined
}
