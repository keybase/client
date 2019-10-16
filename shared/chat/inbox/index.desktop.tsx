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
import {ErrorBoundary} from '../../common-adapters'
import {VariableSizeList} from 'react-window'
import debounce from 'lodash/debounce'
import throttle from 'lodash/throttle'
import {inboxWidth, getRowHeight} from './row/sizes'
import {makeRow} from './row'
import {virtualListMarks} from '../../local-debug'
import shallowEqual from 'shallowequal'

type State = {
  showFloating: boolean
  showUnread: boolean
}

class Inbox extends React.Component<T.Props, State> {
  state = {
    showFloating: false,
    showUnread: false,
  }

  private mounted: boolean = false
  private list: VariableSizeList | null = null

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
      return (
        <div style={divStyle}>
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

  render() {
    const floatingDivider = this.state.showFloating && this.props.allowShowFloatingButton && (
      <BigTeamsDivider toggle={this.props.toggleSmallTeamsExpanded} />
    )
    return (
      <ErrorBoundary>
        <div style={styles.container}>
          <div style={styles.list}>
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
                >
                  {({index, style}) => this.itemRenderer(index, style)}
                </VariableSizeList>
              )}
            </AutoSizer>
          </div>
          {floatingDivider || <BuildTeam />}
          {this.state.showUnread && !this.state.showFloating && (
            <UnreadShortcut onClick={this.scrollToUnread} />
          )}
        </div>
      </ErrorBoundary>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
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
  hover: {backgroundColor: Styles.globalColors.blueGreyDark},
  list: {flex: 1},
}))

export type RowItem = T.RowItem
export type RowItemSmall = T.RowItemSmall
export type RowItemBig = T.RowItemBig
export type RouteState = T.RouteState
export default Inbox
