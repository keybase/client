import * as C from '@/constants'
import * as React from 'react'
import type * as TInbox from './index.d'
import type * as T from '@/constants/types'
import AutoSizer from 'react-virtualized-auto-sizer'
import BigTeamsDivider from './row/big-teams-divider'
import BuildTeam from './row/build-team'
import TeamsDivider from './row/teams-divider'
import UnreadShortcut from './unread-shortcut'
import * as Kb from '@/common-adapters'
import {VariableSizeList} from 'react-window'
import debounce from 'lodash/debounce'
import {inboxWidth, getRowHeight, smallRowHeight, dividerHeight} from './row/sizes'
import {makeRow} from './row'
import './inbox.css'

const widths = [10, 80, 2, 66]
const stableWidth = (idx: number) => 160 + -widths[idx % widths.length]!

const FakeRow = ({idx}: {idx: number}) => (
  <Kb.Box2 direction="horizontal" style={styles.fakeRow}>
    <Kb.Box2 direction="vertical" style={styles.fakeAvatar} />
    <Kb.Box2 direction="vertical" style={styles.fakeText}>
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([styles.fakeTextTop, {width: stableWidth(idx) / 4}])}
        alignSelf="flex-start"
      />
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([styles.fakeTextBottom, {width: stableWidth(idx)}])}
        alignSelf="flex-start"
      />
    </Kb.Box2>
  </Kb.Box2>
)

const FakeRemovingRow = () => <Kb.Box2 direction="horizontal" style={styles.fakeRemovingRow} />

const dragKey = '__keybase_inbox'

const Inbox = React.memo(function Inbox(props: TInbox.Props) {
  const {smallTeamsExpanded, rows, unreadIndices, unreadTotal, inboxNumSmallRows} = props
  const {toggleSmallTeamsExpanded, navKey, selectedConversationIDKey} = props
  const [dragY, setDragY] = React.useState(-1)
  const [showFloating, setShowFloating] = React.useState(false)
  const [showUnread, setShowUnread] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)

  const listRef = React.useRef<VariableSizeList>(null)
  const dragListRef = React.useRef<HTMLDivElement>(null)
  const scrollDiv = React.useRef<HTMLDivElement>(null)

  // stuff for UnreadShortcut
  const firstOffscreenIdx = React.useRef(-1)
  const lastVisibleIdx = React.useRef(-1)

  const mountedRef = React.useRef(true)
  React.useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const lastSmallTeamsExpanded = React.useRef(smallTeamsExpanded)
  const lastRowsLength = React.useRef(rows.length)
  const lastUnreadIndices = React.useRef(unreadIndices)
  const lastUnreadTotal = React.useRef(unreadTotal)

  const itemSizeGetter = React.useCallback(
    (index: number) => {
      const row = rows[index]
      if (!row) {
        return 0
      }

      return getRowHeight(row.type, row.type === 'divider' && row.showButton)
    },
    [rows]
  )

  const deltaNewSmallRows = React.useCallback(() => {
    if (dragY === -1) {
      return 0
    }
    return Math.max(0, Math.floor(dragY / smallRowHeight)) - inboxNumSmallRows
  }, [dragY, inboxNumSmallRows])

  const onDragStart = React.useCallback((ev: React.DragEvent<HTMLDivElement>) => {
    ev.dataTransfer.setData(dragKey, dragKey)
  }, [])

  const itemRenderer = React.useCallback(
    (index: number, style: Object) => {
      const row = rows[index]
      if (!row) {
        // likely small teams were just collapsed
        return null
      }

      const divStyle = style

      if (row.type === 'divider') {
        const newSmallRows = deltaNewSmallRows()
        let expandingRows: Array<string> = []
        let removingRows: Array<string> = []
        if (newSmallRows === 0) {
        } else if (newSmallRows > 0) {
          expandingRows = new Array(newSmallRows).fill('')
        } else {
          removingRows = new Array(-newSmallRows).fill('')
        }
        return (
          <div style={{...divStyle, position: 'relative'}}>
            {row.showButton && !smallTeamsExpanded && (
              <>
                <div
                  className="grabLinesContainer"
                  draggable={row.showButton}
                  onDragStart={onDragStart}
                  style={styles.grabber as any}
                >
                  <Kb.Box2 className="grabLines" direction="vertical" style={styles.grabberLineContainer}>
                    <Kb.Box2 direction="horizontal" style={styles.grabberLine} />
                    <Kb.Box2 direction="horizontal" style={styles.grabberLine} />
                    <Kb.Box2 direction="horizontal" style={styles.grabberLine} />
                  </Kb.Box2>
                </div>
                <Kb.Box style={styles.spacer} />
              </>
            )}
            {dragY !== -1 && (
              <Kb.Box2
                direction="vertical"
                style={Kb.Styles.collapseStyles([
                  styles.fakeRowContainer,
                  {
                    bottom: expandingRows.length ? undefined : dividerHeight(row.showButton),
                    height:
                      (expandingRows.length ? expandingRows.length : removingRows.length) * smallRowHeight,
                    top: expandingRows.length ? 0 : undefined,
                  },
                ])}
              >
                {expandingRows.map((_, idx) => (
                  <FakeRow idx={idx} key={idx} />
                ))}
                {removingRows.map((_, idx) => (
                  <FakeRemovingRow key={idx} />
                ))}
              </Kb.Box2>
            )}
            <TeamsDivider
              hiddenCountDelta={newSmallRows !== 0 ? -newSmallRows : 0}
              key="divider"
              toggle={toggleSmallTeamsExpanded}
              showButton={row.showButton}
              rows={rows}
              smallTeamsExpanded={smallTeamsExpanded}
            />
          </div>
        )
      }
      if (row.type === 'teamBuilder') {
        return (
          <div style={divStyle}>
            <BuildTeam />
          </div>
        )
      }

      // pointer events on so you can click even right after a scroll
      return (
        <div style={Kb.Styles.collapseStyles([divStyle, {pointerEvents: 'auto'}]) as React.CSSProperties}>
          {makeRow(row, navKey, selectedConversationIDKey === row.conversationIDKey)}
        </div>
      )
    },
    [
      dragY,
      smallTeamsExpanded,
      toggleSmallTeamsExpanded,
      deltaNewSmallRows,
      navKey,
      rows,
      selectedConversationIDKey,
      onDragStart,
    ]
  )

  if (smallTeamsExpanded !== lastSmallTeamsExpanded.current || rows.length !== lastRowsLength.current) {
    listRef.current?.resetAfterIndex(0, true)
  }

  const calculateShowFloating = React.useCallback(() => {
    if (lastVisibleIdx.current < 0) {
      return
    }
    let show = true
    const row = rows[lastVisibleIdx.current]
    if (!row || row.type !== 'small') {
      show = false
    }
    setShowFloating(show)
  }, [rows])

  const calculateShowUnreadShortcut = React.useCallback(() => {
    if (!mountedRef.current) {
      return
    }
    if (!unreadIndices.size || lastVisibleIdx.current < 0) {
      if (showUnread) {
        setShowUnread(false)
      }
      return
    }

    let unreadCount = 0
    let foid = 0
    unreadIndices.forEach((count, idx) => {
      if (idx > lastVisibleIdx.current) {
        if (foid <= 0) {
          foid = idx
        }
        unreadCount += count
      }
    })
    if (foid) {
      setShowUnread(true)
      setUnreadCount(unreadCount)
      firstOffscreenIdx.current = foid
    } else {
      setShowUnread(false)
      setUnreadCount(0)
      firstOffscreenIdx.current = -1
    }
  }, [showUnread, unreadIndices])

  const calculateShowUnreadShortcutThrottled = C.useThrottledCallback(calculateShowUnreadShortcut, 100)

  if (rows.length !== lastRowsLength.current) {
    calculateShowFloating()
  }

  if (!C.shallowEqual(lastUnreadIndices.current, unreadIndices) || lastUnreadTotal.current !== unreadTotal) {
    calculateShowUnreadShortcut()
  }

  lastSmallTeamsExpanded.current = smallTeamsExpanded
  lastRowsLength.current = rows.length
  lastUnreadIndices.current = unreadIndices
  lastUnreadTotal.current = unreadTotal

  const p = {
    ...props,
    calculateShowFloating,
    calculateShowUnreadShortcutThrottled,
    deltaNewSmallRows,
    dragListRef,
    dragY,
    firstOffscreenIdx,
    itemRenderer,
    itemSizeGetter,
    lastVisibleIdx,
    listRef,
    mounted: mountedRef.current,
    onDragStart,
    scrollDiv,
    setDragY,
    setShowFloating,
    setShowUnread,
    setUnreadCount,
    showFloating,
    showUnread,
    unreadCount,
  }

  return <InboxOld {...p} />
})

class InboxOld extends React.Component<
  TInbox.Props & {
    deltaNewSmallRows: () => number
    itemSizeGetter: (index: number) => 56 | 0 | 24 | 32 | 40 | 64 | 68 | 44 | 84 | 41
    itemRenderer: (index: number, style: Object) => React.JSX.Element | null
    onDragStart: (ev: React.DragEvent<HTMLDivElement>) => void
    scrollDiv: React.RefObject<HTMLDivElement>
    listRef: React.RefObject<VariableSizeList>
    dragListRef: React.RefObject<HTMLDivElement>
    dragY: number
    setDragY: (y: number) => void
    showFloating: boolean
    setShowFloating: (show: boolean) => void
    showUnread: boolean
    setShowUnread: (show: boolean) => void
    unreadCount: number
    setUnreadCount: (count: number) => void
    mounted: boolean
    firstOffscreenIdx: React.MutableRefObject<number>
    lastVisibleIdx: React.MutableRefObject<number>
    calculateShowFloating: () => void
    calculateShowUnreadShortcutThrottled: () => void
  }
> {
  private onItemsRendered = ({
    visibleStartIndex,
    visibleStopIndex,
  }: {
    visibleStartIndex: number
    visibleStopIndex: number
  }) => {
    this.props.lastVisibleIdx.current = visibleStopIndex
    this.props.calculateShowUnreadShortcutThrottled()
    this.onItemsRenderedDebounced({visibleStartIndex, visibleStopIndex})
  }

  private onItemsRenderedDebounced = debounce((p: {visibleStartIndex: number; visibleStopIndex: number}) => {
    if (!this.props.mounted) {
      return
    }
    const {visibleStartIndex, visibleStopIndex} = p
    const toUnbox = this.props.rows
      .slice(visibleStartIndex, visibleStopIndex + 1)
      .reduce<Array<T.Chat.ConversationIDKey>>((arr, r) => {
        if ((r.type === 'small' || r.type === 'big') && r.conversationIDKey) {
          arr.push(r.conversationIDKey)
        }
        return arr
      }, [])
    this.props.calculateShowFloating()
    this.props.onUntrustedInboxVisible(toUnbox)
  }, 200)

  private scrollToUnread = () => {
    if (this.props.firstOffscreenIdx.current <= 0 || !this.props.scrollDiv.current) {
      return
    }
    let top = 100 // give it some space below
    for (let i = this.props.lastVisibleIdx.current; i <= this.props.firstOffscreenIdx.current; i++) {
      top += this.props.itemSizeGetter(i)
    }
    this.props.scrollDiv.current.scrollBy({behavior: 'smooth', top})
  }

  private listChild = ({index, style}: {index: number; style: Object}) =>
    this.props.itemRenderer(index, style)

  private onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (
      this.props.scrollDiv.current &&
      e.dataTransfer.types.length > 0 &&
      e.dataTransfer.types[0] === dragKey
    ) {
      this.props.setDragY(
        e.clientY -
          this.props.scrollDiv.current.getBoundingClientRect().top +
          this.props.scrollDiv.current.scrollTop
      )
    }
  }

  private onDrop = () => {
    const delta = this.props.deltaNewSmallRows()
    if (delta !== 0) {
      this.props.setInboxNumSmallRows(this.props.inboxNumSmallRows + delta)
    }
    this.props.setDragY(-1)
  }

  private scrollToBigTeams = () => {
    if (!this.props.scrollDiv.current) return

    if (this.props.smallTeamsExpanded) {
      this.props.toggleSmallTeamsExpanded()
    }

    // Should we scroll?
    const top = this.props.inboxNumSmallRows * smallRowHeight
    const boundingHeight = this.props.scrollDiv.current.getBoundingClientRect().height
    const dragHeight = 76 // grabbed from inspector
    const currentScrollTop = this.props.scrollDiv.current.scrollTop
    if (boundingHeight + currentScrollTop < top + dragHeight) {
      this.props.scrollDiv.current.scrollBy({behavior: 'smooth', top})
    }
  }

  render() {
    const floatingDivider = this.props.showFloating && this.props.allowShowFloatingButton && (
      <BigTeamsDivider toggle={this.scrollToBigTeams} />
    )
    return (
      <Kb.ErrorBoundary>
        <Kb.Box className="inbox-hover-container" style={styles.container}>
          <div
            style={styles.list}
            onDragEnd={this.onDrop}
            onDragOver={this.onDragOver}
            onDrop={this.onDrop}
            ref={this.props.dragListRef}
          >
            {this.props.rows.length ? (
              <AutoSizer>
                {(p: {height?: number; width?: number}) => {
                  let {height = 1, width = 1} = p
                  if (isNaN(height)) {
                    height = 1
                  }
                  if (isNaN(width)) {
                    width = 1
                  }
                  return (
                    <VariableSizeList
                      height={height}
                      width={width}
                      ref={this.props.listRef}
                      outerRef={this.props.scrollDiv}
                      onItemsRendered={this.onItemsRendered}
                      itemCount={this.props.rows.length}
                      itemSize={this.props.itemSizeGetter}
                      estimatedItemSize={56}
                      itemData={
                        this.props.dragY === -1
                          ? {rows: this.props.rows, sel: this.props.selectedConversationIDKey}
                          : this.props.dragY
                      }
                    >
                      {this.listChild}
                    </VariableSizeList>
                  )
                }}
              </AutoSizer>
            ) : null}
          </div>
          {floatingDivider || (this.props.rows.length === 0 && <BuildTeam />)}
          {this.props.showUnread && !this.props.showFloating && (
            <UnreadShortcut onClick={this.scrollToUnread} unreadCount={this.props.unreadCount} />
          )}
        </Kb.Box>
      </Kb.ErrorBoundary>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          contain: 'strict',
          height: '100%',
          maxWidth: inboxWidth,
          minWidth: inboxWidth,
          position: 'relative',
        },
      }),
      divider: {
        backgroundColor: 'purple',
        overflow: 'hidden',
      },
      fakeAvatar: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.black_10,
          borderRadius: '50%',
          height: 48,
          marginLeft: 8,
          width: 48,
        },
      }),
      fakeRemovingRow: Kb.Styles.platformStyles({
        isElectron: {
          height: 56,
          position: 'relative',
          width: '100%',
        },
      }),
      fakeRemovingRowDivider: {
        position: 'absolute',
        top: 0,
        width: '100%',
      },
      fakeRow: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          height: 56,
          position: 'relative',
          width: '100%',
        },
      }),
      fakeRowContainer: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        left: 0,
        position: 'absolute',
        right: 0,
        zIndex: 9999,
      },
      fakeRowDivider: {
        bottom: 0,
        position: 'absolute',
        width: '100%',
      },
      fakeText: {
        flexGrow: 1,
        height: '100%',
        justifyContent: 'space-around',
        padding: 8,
        paddingLeft: 16,
      },
      fakeTextBottom: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.black_10,
          borderRadius: 8,
          height: 10,
          width: '75%',
        },
      }),
      fakeTextTop: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.black_10,
          borderRadius: 8,
          height: 10,
          width: '25%',
        },
      }),
      grabber: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          backgroundColor: Kb.Styles.globalColors.black_05,
          bottom: 8,
          height: Kb.Styles.globalMargins.tiny,
          justifyContent: 'center',
          position: 'absolute',
          width: '100%',
        },
        isElectron: {
          cursor: 'row-resize',
        },
      }),
      grabberLine: {
        backgroundColor: Kb.Styles.globalColors.black_35,
        height: 1,
        marginBottom: 1,
        width: '100%',
      },
      grabberLineContainer: {
        paddingTop: 1,
        width: Kb.Styles.globalMargins.small,
      },
      hover: {backgroundColor: Kb.Styles.globalColors.blueGreyDark},
      list: {flex: 1},
      rowWithDragger: {
        height: 68,
      },
      spacer: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        bottom: 0,
        height: 8,
        position: 'absolute',
        width: '100%',
      },
    }) as const
)

export default Inbox
