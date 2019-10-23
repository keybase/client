import * as Constants from '../../constants/chat2'
import * as React from 'react'
import * as Styles from '../../styles'
import * as T from './index.d'
import * as Types from '../../constants/types/chat2'
import AutoSizer from 'react-virtualized-auto-sizer'
import BigTeamsDivider from './row/big-teams-divider/container'
import BuildTeam from './row/build-team/container'
import TeamsDivider from './row/teams-divider/container'
import UnreadShortcut from './unread-shortcut'
import * as Kb from '../../common-adapters'
import {VariableSizeList} from 'react-window'
import debounce from 'lodash/debounce'
import throttle from 'lodash/throttle'
import {inboxWidth, getRowHeight, smallRowHeight, dividerHeight} from './row/sizes'
import {makeRow} from './row'
import {virtualListMarks} from '../../local-debug'
import shallowEqual from 'shallowequal'

type State = {
  dragging: boolean
  dragY: number
  showFloating: boolean
  showUnread: boolean
}

const widths = [10, 80, 2, 66]
const stableWidth = (idx: number) => 160 + -widths[idx % widths.length]

const FakeRow = ({idx, last}) => (
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
    {last && <Kb.Divider style={styles.fakeRowDivider} />}
  </Kb.Box2>
)

const HoverBox = Styles.styled(Kb.Box2)(() => ({
  opacity: 0.25,
  transition: 'opacity 0.25s ease-in-out',
  '.hiddenGrabber': {
    opacity: 0,
    transition: 'opacity 0.25s ease-in-out',
  },
  ':hover, :hover .hiddenGrabber': {opacity: 1}
}))

const FakeRemovingRow = ({first}) => (
  <Kb.Box2 direction="horizontal" style={styles.fakeRemovingRow}>
    {first && <Kb.Divider style={styles.fakeRemovingRowDivider} />}
  </Kb.Box2>
)

class Inbox extends React.Component<T.Props, State> {
  state = {
    dragging: false,
    dragY: -1,
    showFloating: false,
    showUnread: false,
  }

  private mounted: boolean = false
  private list: VariableSizeList | null = null

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

    if (listRowsResized && this.list) {
      this.list.resetAfterIndex(0, true)
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
    if (!shallowEqual(this.props.unreadIndices, prevProps.unreadIndices)) {
      this.calculateShowUnreadShortcut()
    }
  }

  componentDidMount() {
    this.mounted = true
  }

  componentWillUnmount() {
    this.mounted = false
  }

  private itemSizeGetter = index => {
    const row = this.props.rows[index]
    if (!row) {
      return 0
    }

    return getRowHeight(row.type, row.type === 'divider' && row.showButton)
  }

  private itemRenderer = (index, style) => {
    const row = this.props.rows[index]
    if (!row) {
      // likely small teams were just collapsed
      return null
    }
    const divStyle = Styles.collapseStyles([style, virtualListMarks && styles.divider])
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
        <div style={{...divStyle, position: 'relative'}} draggable={true}>
          <HoverBox
            direction="vertical"
            style={Styles.collapseStyles([
              styles.grabberContainer,
              {
                cursor: this.state.dragging ? '-webkit-grabbing' : 'grab',
              },
            ])}
            onMouseDown={() => this.setState({dragging: true})}
            onMouseUp={() => this.setState({dragging: false})}
          >
            <div className="hiddenGrabber" style={styles.grabber} />
            <div style={styles.grabber} />
            <div className="hiddenGrabber" style={styles.grabber} />
          </HoverBox>
          {this.state.dragY !== -1 && (
            <Kb.Box2
              direction="vertical"
              style={Styles.collapseStyles([styles.fakeRowContainer, {
                bottom: expandingRows.length ? undefined : dividerHeight(row.showButton),
                height: (expandingRows.length ? expandingRows.length : removingRows.length) * smallRowHeight,
                top: expandingRows.length ? 0 : undefined,
              }])}
            >
              {expandingRows.map((_, idx) => (
                <FakeRow idx={idx} key={idx} last={expandingRows.length - 1 === idx} />
              ))}
              {removingRows.map((_, idx) => (
                <FakeRemovingRow key={idx} first={idx === 0} />
              ))}
            </Kb.Box2>
          )}
          <TeamsDivider
            key="divider"
            toggle={this.props.toggleSmallTeamsExpanded}
            showButton={row.showButton}
            rows={this.props.rows}
          />
        </div>
      )
    }

    const conversationIDKey: Types.ConversationIDKey = row.conversationIDKey || Constants.noConversationIDKey
    const teamname = row.teamname || ''

    // pointer events on so you can click even right after a scroll
    return (
      <div style={Styles.collapseStyles([divStyle, {pointerEvents: 'auto'}])}>
        {makeRow({
          channelname: (row.type === 'big' && row.channelname) || '',
          conversationIDKey,
          isTeam: row.isTeam || false,
          navKey: this.props.navKey,
          snippet: row.snippet,
          snippetDecoration: row.snippetDecoration,
          teamname,
          time: row.time || undefined,
          type: row.type,
        })}
      </div>
    )
  }

  private calculateShowUnreadShortcut = () => {
    if (!this.mounted) {
      return
    }
    if (!this.props.unreadIndices.length || this.lastVisibleIdx < 0) {
      if (this.state.showUnread) {
        this.setState({showUnread: false})
      }
      return
    }

    const firstOffscreenIdx = this.props.unreadIndices.find(idx => idx > this.lastVisibleIdx)
    if (firstOffscreenIdx) {
      if (!this.state.showUnread) {
        this.setState({showUnread: true})
      }
      this.firstOffscreenIdx = firstOffscreenIdx
    } else {
      if (this.state.showUnread) {
        this.setState({showUnread: false})
      }
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

  private onItemsRendered = ({visibleStartIndex, visibleStopIndex}) => {
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

  private setRef = (list: VariableSizeList | null) => {
    this.list = list
  }

  private listChild = ({index, style}) => this.itemRenderer(index, style)

  private onDragOver = e => {
    if (this.scrollDiv.current) {
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

  render() {
    const floatingDivider = this.state.showFloating && this.props.allowShowFloatingButton && (
      <BigTeamsDivider toggle={this.props.toggleSmallTeamsExpanded} />
    )
    return (
      <Kb.ErrorBoundary>
        <div style={styles.container}>
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
                  ref={this.setRef}
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
          {floatingDivider || <BuildTeam />}
          {this.state.showUnread && !this.state.showFloating && (
            <UnreadShortcut onClick={this.scrollToUnread} />
          )}
        </div>
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
      fakeRemovingRowDivider:{
        top: 0,
        position: 'absolute',
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
      grabber: {
        backgroundColor: Styles.globalColors.black_10,
        borderRadius: Styles.borderRadius,
        boxShadow: Styles.desktopStyles.boxShadow,
        height: 2,
        marginBottom: 1,
        marginLeft: 8,
        marginRight: 8,
        marginTop: 1,
      },
      grabberContainer: {
        height: '100%',
        justifyContent: 'center',
        position: 'absolute',
        width: '100%',
      },
      hover: {backgroundColor: Styles.globalColors.blueGreyDark},
      list: {flex: 1},
    } as const)
)

export type RowItem = T.RowItem
export type RowItemSmall = T.RowItemSmall
export type RowItemBig = T.RowItemBig
export type RouteState = T.RouteState
export default Inbox
