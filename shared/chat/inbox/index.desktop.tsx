import * as React from 'react'
import * as Styles from '../../styles'
import type * as T from './index.d'
import type * as Types from '../../constants/types/chat2'
import AutoSizer from 'react-virtualized-auto-sizer'
import BigTeamsDivider from './row/big-teams-divider'
import BuildTeam from './row/build-team'
import TeamsDivider from './row/teams-divider'
import UnreadShortcut from './unread-shortcut'
import * as Kb from '../../common-adapters'
import {VariableSizeList} from 'react-window'
import debounce from 'lodash/debounce'
import throttle from 'lodash/throttle'
import {inboxWidth, getRowHeight, smallRowHeight, dividerHeight} from './row/sizes'
import {makeRow} from './row'
import shallowEqual from 'shallowequal'
import './inbox.css'

type State = {
  dragY: number
  showFloating: boolean
  showUnread: boolean
  unreadCount: number
}

const widths = [10, 80, 2, 66]
const stableWidth = (idx: number) => 160 + -widths[idx % widths.length]

const FakeRow = ({idx}: {idx: number}) => (
  <Kb.Box2 direction="horizontal" style={styles.fakeRow}>
    <Kb.Box2 direction="vertical" style={styles.fakeAvatar} />
    <Kb.Box2 direction="vertical" style={styles.fakeText}>
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([styles.fakeTextTop, {width: stableWidth(idx) / 4}])}
        alignSelf="flex-start"
      />
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([styles.fakeTextBottom, {width: stableWidth(idx)}])}
        alignSelf="flex-start"
      />
    </Kb.Box2>
  </Kb.Box2>
)

const FakeRemovingRow = () => <Kb.Box2 direction="horizontal" style={styles.fakeRemovingRow} />

const dragKey = '__keybase_inbox'

class Inbox extends React.Component<T.Props, State> {
  state = {
    dragY: -1,
    showFloating: false,
    showUnread: false,
    unreadCount: 0,
  }

  private mounted: boolean = false
  private listRef = React.createRef<VariableSizeList>()

  private dragList = React.createRef<HTMLDivElement>()

  // stuff for UnreadShortcut
  private firstOffscreenIdx: number = -1
  private lastVisibleIdx: number = -1
  private scrollDiv = React.createRef<HTMLDivElement>()

  shouldComponentUpdate(nextProps: T.Props, nextState: State) {
    let listRowsResized = false
    if (nextProps.smallTeamsExpanded !== this.props.smallTeamsExpanded) {
      listRowsResized = true
    }

    // list changed
    if (this.props.rows.length !== nextProps.rows.length) {
      listRowsResized = true
    }

    if (listRowsResized && this.listRef.current) {
      this.listRef.current.resetAfterIndex(0, true)
      // ^ this will force an update so just do it once instead of twice
      return false
    }
    return !shallowEqual(this.props, nextProps) || !shallowEqual(this.state, nextState)
  }

  componentDidUpdate(prevProps: T.Props) {
    // list changed
    if (this.props.rows.length !== prevProps.rows.length) {
      this.calculateShowFloating()
    }
    if (
      !shallowEqual(prevProps.unreadIndices, this.props.unreadIndices) ||
      prevProps.unreadTotal !== this.props.unreadTotal
    ) {
      this.calculateShowUnreadShortcut()
    }
  }

  componentDidMount() {
    this.mounted = true
  }

  componentWillUnmount() {
    this.mounted = false
  }

  private itemSizeGetter = (index: number) => {
    const row = this.props.rows[index]
    if (!row) {
      return 0
    }

    return getRowHeight(row.type, row.type === 'divider' && row.showButton)
  }

  private onDragStart = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.dataTransfer.setData(dragKey, dragKey)
  }

  private itemRenderer = (index: number, style: Object) => {
    const row = this.props.rows[index]
    if (!row) {
      // likely small teams were just collapsed
      return null
    }
    const divStyle = style
    if (row.type === 'divider') {
      const newSmallRows = this.deltaNewSmallRows()
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
          {row.showButton && !this.props.smallTeamsExpanded && (
            <>
              <Kb.Box
                className="grabLinesContainer"
                draggable={row.showButton}
                onDragStart={this.onDragStart}
                style={styles.grabber}
              >
                <Kb.Box2 className="grabLines" direction="vertical" style={styles.grabberLineContainer}>
                  <Kb.Box2 direction="horizontal" style={styles.grabberLine} />
                  <Kb.Box2 direction="horizontal" style={styles.grabberLine} />
                  <Kb.Box2 direction="horizontal" style={styles.grabberLine} />
                </Kb.Box2>
              </Kb.Box>
              <Kb.Box style={styles.spacer} />
            </>
          )}
          {this.state.dragY !== -1 && (
            <Kb.Box2
              direction="vertical"
              style={Styles.collapseStyles([
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
            toggle={this.props.toggleSmallTeamsExpanded}
            showButton={row.showButton}
            rows={this.props.rows}
            smallTeamsExpanded={this.props.smallTeamsExpanded}
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
      <div style={Styles.collapseStyles([divStyle, {pointerEvents: 'auto'} as any])}>
        {makeRow(row, this.props.navKey)}
      </div>
    )
  }

  private calculateShowUnreadShortcut = () => {
    if (!this.mounted) {
      return
    }
    if (!this.props.unreadIndices.size || this.lastVisibleIdx < 0) {
      if (this.state.showUnread) {
        this.setState({showUnread: false})
      }
      return
    }

    let unreadCount = 0
    let firstOffscreenIdx = 0
    this.props.unreadIndices.forEach((count, idx) => {
      if (idx > this.lastVisibleIdx) {
        if (firstOffscreenIdx <= 0) {
          firstOffscreenIdx = idx
        }
        unreadCount += count
      }
    })
    if (firstOffscreenIdx) {
      this.setState(s => (s.showUnread ? null : {showUnread: true}))
      this.setState(() => ({unreadCount}))
      this.firstOffscreenIdx = firstOffscreenIdx
    } else {
      this.setState(s => (s.showUnread ? {showUnread: false, unreadCount: 0} : null))
      this.firstOffscreenIdx = -1
    }
  }

  private calculateShowUnreadShortcutThrottled = throttle(this.calculateShowUnreadShortcut, 100)

  private calculateShowFloating = () => {
    if (this.lastVisibleIdx < 0) {
      return
    }
    let showFloating = true
    const row = this.props.rows[this.lastVisibleIdx]
    if (!row || row.type !== 'small') {
      showFloating = false
    }

    if (this.state.showFloating !== showFloating) {
      this.setState({showFloating})
    }
  }

  private onItemsRendered = ({
    visibleStartIndex,
    visibleStopIndex,
  }: {
    visibleStartIndex: number
    visibleStopIndex: number
  }) => {
    this.lastVisibleIdx = visibleStopIndex
    this.calculateShowUnreadShortcutThrottled()
    this.onItemsRenderedDebounced({visibleStartIndex, visibleStopIndex})
  }

  private onItemsRenderedDebounced = debounce(({visibleStartIndex, visibleStopIndex}) => {
    if (!this.mounted) {
      return
    }
    const toUnbox = this.props.rows
      .slice(visibleStartIndex, visibleStopIndex + 1)
      .reduce<Array<Types.ConversationIDKey>>((arr, r) => {
        if (r.type === 'small' && r.conversationIDKey) {
          arr.push(r.conversationIDKey)
        }
        return arr
      }, [])
    this.calculateShowFloating()
    this.props.onUntrustedInboxVisible(toUnbox)
  }, 200)

  private scrollToUnread = () => {
    if (this.firstOffscreenIdx <= 0 || !this.scrollDiv.current) {
      return
    }
    let top = 100 // give it some space below
    for (let i = this.lastVisibleIdx; i <= this.firstOffscreenIdx; i++) {
      top += this.itemSizeGetter(i)
    }
    this.scrollDiv.current.scrollBy({behavior: 'smooth', top})
  }

  private listChild = ({index, style}: {index: number; style: Object}) => this.itemRenderer(index, style)

  private onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (this.scrollDiv.current && e.dataTransfer.types.length > 0 && e.dataTransfer.types[0] === dragKey) {
      this.setState({
        dragY:
          e.clientY - this.scrollDiv.current.getBoundingClientRect().top + this.scrollDiv.current.scrollTop,
      })
    }
  }

  private deltaNewSmallRows = () => {
    if (this.state.dragY === -1) {
      return 0
    }
    return Math.max(0, Math.floor(this.state.dragY / smallRowHeight)) - this.props.inboxNumSmallRows
  }

  private onDrop = () => {
    const delta = this.deltaNewSmallRows()
    if (delta !== 0) {
      this.props.setInboxNumSmallRows(this.props.inboxNumSmallRows + delta)
    }
    this.setState({dragY: -1})
  }

  private scrollToBigTeams = () => {
    if (!this.scrollDiv.current) return

    if (this.props.smallTeamsExpanded) {
      this.props.toggleSmallTeamsExpanded()
    }

    // Should we scroll?
    const top = this.props.inboxNumSmallRows * smallRowHeight
    const boundingHeight = this.scrollDiv.current.getBoundingClientRect().height
    const dragHeight = 76 // grabbed from inspector
    const currentScrollTop = this.scrollDiv.current.scrollTop
    if (boundingHeight + currentScrollTop < top + dragHeight) {
      this.scrollDiv.current && this.scrollDiv.current.scrollBy({behavior: 'smooth', top})
    }
  }

  render() {
    const floatingDivider = this.state.showFloating && this.props.allowShowFloatingButton && (
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
            ref={this.dragList}
          >
            <AutoSizer>
              {({height, width}) => (
                <VariableSizeList
                  height={height}
                  width={width}
                  ref={this.listRef}
                  outerRef={this.scrollDiv}
                  onItemsRendered={this.onItemsRendered}
                  itemCount={this.props.rows.length}
                  itemSize={this.itemSizeGetter}
                  estimatedItemSize={56}
                  itemData={this.state.dragY === -1 ? this.props.rows : this.state.dragY}
                >
                  {this.listChild}
                </VariableSizeList>
              )}
            </AutoSizer>
          </div>
          {floatingDivider || (this.props.rows.length === 0 && <BuildTeam />)}
          {this.state.showUnread && !this.state.showFloating && (
            <UnreadShortcut onClick={this.scrollToUnread} unreadCount={this.state.unreadCount} />
          )}
        </Kb.Box>
      </Kb.ErrorBoundary>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.flexBoxColumn,
          backgroundColor: Styles.globalColors.blueGrey,
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
      fakeAvatar: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.black_10,
          borderRadius: '50%',
          height: 48,
          marginLeft: 8,
          width: 48,
        },
      }),
      fakeRemovingRow: Styles.platformStyles({
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
      fakeRow: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.blueGrey,
          height: 56,
          position: 'relative',
          width: '100%',
        },
      }),
      fakeRowContainer: {
        backgroundColor: Styles.globalColors.blueGrey,
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
      fakeTextBottom: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.black_10,
          borderRadius: 8,
          height: 10,
          width: '75%',
        },
      }),
      fakeTextTop: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.black_10,
          borderRadius: 8,
          height: 10,
          width: '25%',
        },
      }),
      grabber: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
          backgroundColor: Styles.globalColors.black_05,
          bottom: 8,
          height: Styles.globalMargins.tiny,
          justifyContent: 'center',
          position: 'absolute',
          width: '100%',
        },
        isElectron: {
          cursor: 'row-resize',
        },
      }),
      grabberLine: {
        backgroundColor: Styles.globalColors.black_35,
        height: 1,
        marginBottom: 1,
        width: '100%',
      },
      grabberLineContainer: {
        paddingTop: 1,
        width: Styles.globalMargins.small,
      },
      hover: {backgroundColor: Styles.globalColors.blueGreyDark},
      list: {flex: 1},
      rowWithDragger: {
        height: 68,
      },
      spacer: {
        backgroundColor: Styles.globalColors.blueGrey,
        bottom: 0,
        height: 8,
        position: 'absolute',
        width: '100%',
      },
    } as const)
)

export default Inbox
