// TODO we could use context and connected rows better to avoid so much
// prop drilling / thrash due to props changing inside
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

const dragKey = 'application/keybase_inbox'

const DragLine = (p: {
  scrollDiv: React.RefObject<HTMLDivElement>
  inboxNumSmallRows: number
  showButton: boolean
  smallTeamsExpanded: boolean
  toggleSmallTeamsExpanded: () => void
  setInboxNumSmallRows: (n: number) => void
  style: object
  rows: T.Chat.ChatInboxRowItem[]
}) => {
  const {inboxNumSmallRows, showButton, style, scrollDiv} = p
  const {smallTeamsExpanded, toggleSmallTeamsExpanded, rows, setInboxNumSmallRows} = p
  const [dragY, setDragY] = React.useState(-1)
  const deltaNewSmallRows = React.useCallback(() => {
    if (dragY === -1) {
      return 0
    }
    return Math.max(0, Math.floor(dragY / smallRowHeight)) - inboxNumSmallRows
  }, [dragY, inboxNumSmallRows])

  const newSmallRows = deltaNewSmallRows()
  let expandingRows: Array<string> = []
  let removingRows: Array<string> = []
  if (newSmallRows === 0) {
  } else if (newSmallRows > 0) {
    expandingRows = new Array<string>(newSmallRows).fill('')
  } else {
    removingRows = new Array<string>(-newSmallRows).fill('')
  }

  const throttledDragY = C.useThrottledCallback(setDragY, 100)

  const onDragOver = React.useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      if (
        scrollDiv.current &&
        (e.dataTransfer?.types.length ?? 0) > 0 &&
        e.dataTransfer?.types[0] === dragKey
      ) {
        const dy = e.clientY - scrollDiv.current.getBoundingClientRect().top + scrollDiv.current.scrollTop
        throttledDragY(dy)
      }
    },
    [scrollDiv, throttledDragY]
  )

  const goodDropRef = React.useRef(false)

  const onDrop = React.useCallback((e: DragEvent) => {
    e.preventDefault()
    goodDropRef.current = true
  }, [])

  React.useEffect(() => {
    const d = scrollDiv.current
    if (!d) {
      return
    }
    d.addEventListener('dragover', onDragOver)
    d.addEventListener('drop', onDrop)
    return () => {
      d.removeEventListener('dragover', onDragOver)
      d.removeEventListener('drop', onDrop)
    }
  }, [scrollDiv, onDragOver, onDrop])

  const onDragStart = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(dragKey, dragKey)
    goodDropRef.current = false
  }, [])
  const onDragEnd = React.useCallback(() => {
    if (goodDropRef.current) {
      const delta = deltaNewSmallRows()
      if (delta !== 0) {
        setInboxNumSmallRows(inboxNumSmallRows + delta)
      }
      goodDropRef.current = false
    }
    setDragY(-1)
  }, [setInboxNumSmallRows, inboxNumSmallRows, deltaNewSmallRows])

  return (
    <div style={{...style, position: 'relative'}}>
      {showButton && !smallTeamsExpanded && (
        <>
          <div
            className="grabLinesContainer"
            draggable={true}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            style={Kb.Styles.castStyleDesktop(styles.grabber)}
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
              bottom: expandingRows.length ? undefined : dividerHeight(showButton),
              height: (expandingRows.length ? expandingRows.length : removingRows.length) * smallRowHeight,
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
        showButton={showButton}
        rows={rows}
        smallTeamsExpanded={smallTeamsExpanded}
      />
    </div>
  )
}

const Inbox = React.memo(function Inbox(props: TInbox.Props) {
  const {smallTeamsExpanded, rows, unreadIndices, unreadTotal, inboxNumSmallRows} = props
  const {toggleSmallTeamsExpanded, navKey, selectedConversationIDKey, onUntrustedInboxVisible} = props
  const {setInboxNumSmallRows, allowShowFloatingButton} = props
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

  const scrollToUnread = React.useCallback(() => {
    if (firstOffscreenIdx.current <= 0 || !scrollDiv.current) {
      return
    }
    let top = 100 // give it some space below
    for (let i = lastVisibleIdx.current; i <= firstOffscreenIdx.current; i++) {
      top += itemSizeGetter(i)
    }
    scrollDiv.current.scrollBy({behavior: 'smooth', top})
  }, [itemSizeGetter])

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

  const onItemsRenderedDebounced = C.useDebouncedCallback(
    React.useCallback(
      (p: {visibleStartIndex: number; visibleStopIndex: number}) => {
        if (!mountedRef.current) {
          return
        }
        const {visibleStartIndex, visibleStopIndex} = p
        const toUnbox = rows
          .slice(visibleStartIndex, visibleStopIndex + 1)
          .reduce<Array<T.Chat.ConversationIDKey>>((arr, r) => {
            if ((r.type === 'small' || r.type === 'big') && r.conversationIDKey) {
              arr.push(r.conversationIDKey)
            }
            return arr
          }, [])
        calculateShowFloating()
        onUntrustedInboxVisible(toUnbox)
      },
      [calculateShowFloating, onUntrustedInboxVisible, rows]
    ),
    200
  )

  const itemRenderer = React.useCallback(
    (index: number, style: object) => {
      const row = rows[index]
      if (!row) {
        // likely small teams were just collapsed
        return null
      }

      const divStyle = style

      if (row.type === 'divider') {
        return (
          <DragLine
            scrollDiv={scrollDiv}
            inboxNumSmallRows={inboxNumSmallRows}
            showButton={row.showButton}
            smallTeamsExpanded={smallTeamsExpanded}
            style={divStyle}
            toggleSmallTeamsExpanded={toggleSmallTeamsExpanded}
            rows={rows}
            setInboxNumSmallRows={setInboxNumSmallRows}
          />
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
      inboxNumSmallRows,
      setInboxNumSmallRows,
      smallTeamsExpanded,
      toggleSmallTeamsExpanded,
      navKey,
      rows,
      selectedConversationIDKey,
    ]
  )

  const listChild = React.useCallback(
    ({index, style}: {index: number; style: object}) => itemRenderer(index, style),
    [itemRenderer]
  )

  if (smallTeamsExpanded !== lastSmallTeamsExpanded.current || rows.length !== lastRowsLength.current) {
    // this calls setstate so defer
    setTimeout(() => {
      listRef.current?.resetAfterIndex(0, true)
    }, 0)
  }

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

  const onItemsRendered = React.useCallback(
    ({visibleStartIndex, visibleStopIndex}: {visibleStartIndex: number; visibleStopIndex: number}) => {
      lastVisibleIdx.current = visibleStopIndex
      calculateShowUnreadShortcutThrottled()
      onItemsRenderedDebounced({visibleStartIndex, visibleStopIndex})
    },
    [calculateShowUnreadShortcutThrottled, onItemsRenderedDebounced]
  )

  const scrollToBigTeams = React.useCallback(() => {
    if (!scrollDiv.current) return

    if (smallTeamsExpanded) {
      toggleSmallTeamsExpanded()
    }

    // Should we scroll?
    const top = inboxNumSmallRows * smallRowHeight
    const boundingHeight = scrollDiv.current.getBoundingClientRect().height
    const dragHeight = 76 // grabbed from inspector
    const currentScrollTop = scrollDiv.current.scrollTop
    if (boundingHeight + currentScrollTop < top + dragHeight) {
      scrollDiv.current.scrollBy({behavior: 'smooth', top})
    }
  }, [inboxNumSmallRows, smallTeamsExpanded, toggleSmallTeamsExpanded])

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

  const floatingDivider = showFloating && allowShowFloatingButton && (
    <BigTeamsDivider toggle={scrollToBigTeams} />
  )

  const itemData = React.useMemo(
    () => ({rows, sel: selectedConversationIDKey}),
    [rows, selectedConversationIDKey]
  )

  return (
    <Kb.ErrorBoundary>
      <Kb.Box className="inbox-hover-container" style={styles.container}>
        <div style={styles.list} ref={dragListRef}>
          {rows.length ? (
            <AutoSizer doNotBailOutOnEmptyChildren={true}>
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
                    ref={listRef}
                    outerRef={scrollDiv}
                    onItemsRendered={onItemsRendered}
                    itemCount={rows.length}
                    itemSize={itemSizeGetter}
                    estimatedItemSize={56}
                    itemData={itemData}
                  >
                    {listChild}
                  </VariableSizeList>
                )
              }}
            </AutoSizer>
          ) : null}
        </div>
        {floatingDivider || (rows.length === 0 && <BuildTeam />)}
        {showUnread && !showFloating && <UnreadShortcut onClick={scrollToUnread} unreadCount={unreadCount} />}
      </Kb.Box>
    </Kb.ErrorBoundary>
  )
})

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
