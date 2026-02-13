// TODO we could use context and connected rows better to avoid so much
// prop drilling / thrash due to props changing inside
import * as C from '@/constants'
import * as React from 'react'
import type * as TInbox from './index.d'
import type * as T from '@/constants/types'
import type {ChatInboxRowItem} from './rowitem'
import BigTeamsDivider from './row/big-teams-divider'
import BuildTeam from './row/build-team'
import TeamsDivider from './row/teams-divider'
import UnreadShortcut from './unread-shortcut'
import * as Kb from '@/common-adapters'
import {List, type RowComponentProps, useListRef} from 'react-window'
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
  scrollDiv: React.RefObject<HTMLDivElement | null>
  inboxNumSmallRows: number
  showButton: boolean
  smallTeamsExpanded: boolean
  toggleSmallTeamsExpanded: () => void
  setInboxNumSmallRows: (n: number) => void
  style: object
  rows: ChatInboxRowItem[]
}) => {
  const {inboxNumSmallRows, showButton, style, scrollDiv} = p
  const {smallTeamsExpanded, toggleSmallTeamsExpanded, rows, setInboxNumSmallRows} = p
  const [dragY, setDragY] = React.useState(-1)
  const deltaNewSmallRows = () => {
    if (dragY === -1) {
      return 0
    }
    return Math.max(0, Math.floor(dragY / smallRowHeight)) - inboxNumSmallRows
  }

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

  const goodDropRef = React.useRef(false)

  React.useEffect(() => {
    const d = scrollDiv.current
    if (!d) {
      return
    }
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (
        scrollDiv.current &&
        (e.dataTransfer?.types.length ?? 0) > 0 &&
        e.dataTransfer?.types[0] === dragKey
      ) {
        const scrollableDiv = scrollDiv.current.firstElementChild as HTMLDivElement | null
        if (scrollableDiv) {
          const dy = e.clientY - scrollDiv.current.getBoundingClientRect().top + scrollableDiv.scrollTop
          throttledDragY(dy)
        }
      }
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      goodDropRef.current = true
    }
    d.addEventListener('dragover', onDragOver)
    d.addEventListener('drop', onDrop)
    return () => {
      d.removeEventListener('dragover', onDragOver)
      d.removeEventListener('drop', onDrop)
    }
  }, [scrollDiv, throttledDragY])

  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(dragKey, dragKey)
    goodDropRef.current = false
  }
  const onDragEnd = () => {
    if (goodDropRef.current) {
      const delta = deltaNewSmallRows()
      if (delta !== 0) {
        setInboxNumSmallRows(inboxNumSmallRows + delta)
      }
      goodDropRef.current = false
    }
    setDragY(-1)
  }

  return (
    <div
      style={{
        ...style,
        // so the fake rows are above items further down the list
        zIndex: 999,
      }}
    >
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

type InboxRowData = {
  inboxNumSmallRows: number
  navKey: string
  rows: ChatInboxRowItem[]
  scrollDiv: React.RefObject<HTMLDivElement | null>
  selectedConversationIDKey: string
  setInboxNumSmallRows: (rows: number) => void
  smallTeamsExpanded: boolean
  toggleSmallTeamsExpanded: () => void
}

function InboxRow(p: RowComponentProps<InboxRowData>) {
  const {index, style, rows} = p
  const {scrollDiv, inboxNumSmallRows, smallTeamsExpanded, toggleSmallTeamsExpanded} = p
  const {setInboxNumSmallRows, navKey, selectedConversationIDKey} = p
  const row = rows[index]
  if (!row) {
    // likely small teams were just collapsed
    return <div style={style} />
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
    <div style={{...divStyle, pointerEvents: 'auto'}}>
      {makeRow(row, navKey, selectedConversationIDKey === row.conversationIDKey)}
    </div>
  )
}

const shouldShowFloating = (rows: ChatInboxRowItem[], visibleIdx: number) =>
  visibleIdx >= 0 && rows[visibleIdx]?.type === 'small'

const calcUnreadShortcut = (unreadIndices: Map<number, number>, visibleIdx: number) => {
  if (!unreadIndices.size || visibleIdx < 0) {
    return {firstOffscreen: -1, showUnread: false, unreadCount: 0}
  }
  let unreadCount = 0
  let foid = 0
  unreadIndices.forEach((count, idx) => {
    if (idx > visibleIdx) {
      if (foid <= 0) foid = idx
      unreadCount += count
    }
  })
  if (foid) {
    return {firstOffscreen: foid, showUnread: true, unreadCount}
  }
  return {firstOffscreen: -1, showUnread: false, unreadCount: 0}
}

function Inbox(props: TInbox.Props) {
  const {smallTeamsExpanded, rows, unreadIndices, unreadTotal, inboxNumSmallRows} = props
  const {toggleSmallTeamsExpanded, navKey, selectedConversationIDKey, onUntrustedInboxVisible} = props
  const {setInboxNumSmallRows, allowShowFloatingButton} = props
  const [showFloating, setShowFloating] = React.useState(false)
  const [showUnread, setShowUnread] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)

  const scrollDiv = React.useRef<HTMLDivElement | null>(null)
  const listRef = useListRef(null)

  // stuff for UnreadShortcut
  const firstOffscreenIdx = React.useRef(-1)
  const lastVisibleIdx = React.useRef(-1)

  const lastUnreadIndices = React.useRef(unreadIndices)
  const lastUnreadTotal = React.useRef(unreadTotal)

  const itemSizeGetter = (index: number) => {
    const row = rows[index]
    if (!row) {
      return 0
    }

    return getRowHeight(row.type, row.type === 'divider' && row.showButton)
  }

  const scrollToUnread = () => {
    if (firstOffscreenIdx.current <= 0) {
      return
    }
    listRef.current?.scrollToRow({index: firstOffscreenIdx.current})
  }

  const onItemsRenderedDebounced = C.useDebouncedCallback(
    (p: {startIndex: number; stopIndex: number}) => {
      const {startIndex, stopIndex} = p
      const toUnbox = rows
        .slice(startIndex, stopIndex + 1)
        .reduce<Array<T.Chat.ConversationIDKey>>((arr, r) => {
          if ((r.type === 'small' || r.type === 'big') && r.conversationIDKey) {
            arr.push(r.conversationIDKey)
          }
          return arr
        }, [])
      setShowFloating(shouldShowFloating(rows, lastVisibleIdx.current))
      onUntrustedInboxVisible(toUnbox)
    },
    200
  )

  const calculateShowUnreadShortcutThrottled = C.useThrottledCallback(() => {
    const result = calcUnreadShortcut(unreadIndices, lastVisibleIdx.current)
    setShowUnread(result.showUnread)
    setUnreadCount(result.unreadCount)
    firstOffscreenIdx.current = result.firstOffscreen
  }, 100)

  const onItemsRendered = ({startIndex, stopIndex}: {startIndex: number; stopIndex: number}) => {
    lastVisibleIdx.current = stopIndex
    calculateShowUnreadShortcutThrottled()
    onItemsRenderedDebounced({startIndex, stopIndex})
  }

  const scrollToBigTeams = () => {
    if (!scrollDiv.current) return

    if (smallTeamsExpanded) {
      toggleSmallTeamsExpanded()
    }

    // Should we scroll?
    const scrollableDiv = scrollDiv.current.firstElementChild as HTMLDivElement | null
    if (!scrollableDiv) return

    const top = inboxNumSmallRows * smallRowHeight
    const boundingHeight = scrollableDiv.getBoundingClientRect().height
    const dragHeight = 76 // grabbed from inspector
    const currentScrollTop = scrollableDiv.scrollTop
    if (boundingHeight + currentScrollTop < top + dragHeight) {
      scrollableDiv.scrollBy({behavior: 'smooth', top})
    }
  }

  React.useEffect(() => {
    setShowFloating(shouldShowFloating(rows, lastVisibleIdx.current))
  }, [rows])

  React.useEffect(() => {
    if (
      !C.shallowEqual(lastUnreadIndices.current, unreadIndices) ||
      lastUnreadTotal.current !== unreadTotal
    ) {
      const result = calcUnreadShortcut(unreadIndices, lastVisibleIdx.current)
      setShowUnread(result.showUnread)
      setUnreadCount(result.unreadCount)
      firstOffscreenIdx.current = result.firstOffscreen
    }
  }, [unreadIndices, unreadTotal])

  React.useEffect(() => {
    lastUnreadIndices.current = unreadIndices
    lastUnreadTotal.current = unreadTotal
  }, [unreadTotal, unreadIndices])

  const floatingDivider = showFloating && allowShowFloatingButton && (
    <BigTeamsDivider toggle={scrollToBigTeams} />
  )

  const itemData = {
    inboxNumSmallRows,
    navKey,
    rows,
    scrollDiv,
    selectedConversationIDKey,
    setInboxNumSmallRows,
    smallTeamsExpanded,
    toggleSmallTeamsExpanded,
  }

  return (
    <Kb.ErrorBoundary>
      <Kb.Box className="inbox-hover-container" style={styles.container}>
        <div style={styles.list} ref={scrollDiv}>
          {rows.length ? (
            <List
              listRef={listRef}
              onRowsRendered={onItemsRendered}
              rowCount={rows.length}
              rowHeight={itemSizeGetter}
              rowComponent={InboxRow}
              rowProps={itemData}
            />
          ) : null}
        </div>
        {floatingDivider || (rows.length === 0 && <BuildTeam />)}
        {showUnread && !showFloating && <UnreadShortcut onClick={scrollToUnread} unreadCount={unreadCount} />}
      </Kb.Box>
    </Kb.ErrorBoundary>
  )
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
      list: {
        flex: 1,
        height: '100%',
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
