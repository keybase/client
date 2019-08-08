import * as I from 'immutable'
import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import {makeRow} from './row'
import BuildTeam from './row/build-team/container'
import ChatInboxHeader from './row/chat-inbox-header/container'
import BigTeamsDivider from './row/big-teams-divider/container'
import TeamsDivider from './row/teams-divider/container'
import {virtualListMarks} from '../../local-debug'
import {debounce} from 'lodash-es'
import UnreadShortcut from './unread-shortcut'
import * as RowSizes from './row/sizes'
import InboxSearch from '../inbox-search/container'
import * as T from './index.types.d'
import * as Types from '../../constants/types/chat2'

const NoChats = (props: {onNewChat: () => void}) => (
  <Kb.Box
    style={{
      ...Styles.globalStyles.flexBoxColumn,
      ...Styles.globalStyles.fillAbsolute,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Kb.Text type="BodySmall" negative={true} style={styles.text}>
      All conversations are
    </Kb.Text>
    <Kb.Text type="BodySmall" negative={true} style={styles.text}>
      end-to-end encrypted.
    </Kb.Text>
    <Kb.Button
      onClick={props.onNewChat}
      type="Success"
      mode="Primary"
      label="Start a new chat"
      style={{marginTop: Styles.globalMargins.small}}
    />
  </Kb.Box>
)

type State = {
  showFloating: boolean
  showUnread: boolean
}

class Inbox extends React.PureComponent<T.Props, State> {
  _list: any
  // Help us calculate row heights and offsets quickly
  _dividerIndex: number = -1
  // 2 different sizes
  _dividerShowButton: boolean = false
  // stash first offscreen index for callback
  _firstOffscreenIdx: number = -1
  _lastVisibleIdx: number = -1

  state = {showFloating: false, showUnread: false}

  componentDidUpdate(prevProps: T.Props) {
    if (!I.is(prevProps.unreadIndices, this.props.unreadIndices)) {
      this._updateShowUnread()
    }
    if (this.props.rows.length !== prevProps.rows.length) {
      // list has changed, floating divider is likely to change
      this._updateShowFloating()
    }
  }

  _renderItem = ({item}) => {
    const row = item
    let element
    if (row.type === 'divider') {
      element = (
        <TeamsDivider
          key="divider"
          showButton={row.showButton}
          toggle={this.props.toggleSmallTeamsExpanded}
          rows={this.props.rows}
        />
      )
    } else {
      element = makeRow({
        channelname: row.channelname,
        conversationIDKey: row.conversationIDKey,
        teamname: row.teamname,
        type: row.type,
      })
    }

    if (virtualListMarks) {
      return <Kb.Box style={{backgroundColor: 'purple', overflow: 'hidden'}}>{element}</Kb.Box>
    }

    return element
  }

  _keyExtractor = item => {
    const row = item

    if (row.type === 'divider' || row.type === 'bigTeamsLabel') {
      return row.type
    }

    return (
      (row.type === 'small' && row.conversationIDKey) ||
      (row.type === 'bigHeader' && row.teamname) ||
      (row.type === 'big' && row.conversationIDKey) ||
      'missingkey'
    )
  }

  _askForUnboxing = (rows: Array<T.RowItem>) => {
    const toUnbox = rows.reduce<Array<Types.ConversationIDKey>>((arr, r) => {
      if (r.type === 'small' && r.conversationIDKey) {
        arr.push(r.conversationIDKey)
      }
      return arr
    }, [])
    this.props.onUntrustedInboxVisible(toUnbox)
  }

  _onViewChanged = data => {
    if (!data) {
      return
    }
    this._onScrollUnbox(data)

    const lastVisibleIdx = // Auto generated from flowToTs. Please clean me!
      data.viewableItems[data.viewableItems.length - 1] === null ||
      data.viewableItems[data.viewableItems.length - 1] === undefined
        ? undefined
        : data.viewableItems[data.viewableItems.length - 1].index
    this._lastVisibleIdx = lastVisibleIdx || -1
    this._updateShowUnread()
    this._updateShowFloating()
  }

  _updateShowUnread = () => {
    if (!this.props.unreadIndices.size || this._lastVisibleIdx < 0) {
      this.setState(s => (s.showUnread ? {showUnread: false} : null))
      return
    }

    const firstOffscreenIdx = this.props.unreadIndices.find(idx => idx > this._lastVisibleIdx)
    if (firstOffscreenIdx) {
      this.setState(s => (s.showUnread ? null : {showUnread: true}))
      this._firstOffscreenIdx = firstOffscreenIdx
    } else {
      this.setState(s => (s.showUnread ? {showUnread: false} : null))
      this._firstOffscreenIdx = -1
    }
  }

  _scrollToUnread = () => {
    if (this._firstOffscreenIdx <= 0 || !this._list) {
      return
    }
    this._list.scrollToIndex({
      animated: true,
      index: this._firstOffscreenIdx,
      viewPosition: 0.5,
    })
  }

  _updateShowFloating = () => {
    if (this._lastVisibleIdx < 0) {
      return
    }
    let showFloating = true
    const row = this.props.rows[this._lastVisibleIdx]
    if (!row) {
      return
    }

    if (!row || row.type !== 'small') {
      showFloating = false
    }

    if (this.state.showFloating !== showFloating) {
      this.setState({showFloating})
    }
  }

  _onScrollUnbox = debounce(data => {
    const {viewableItems} = data
    const item = viewableItems && viewableItems[0]
    if (item && Object.prototype.hasOwnProperty.call(item, 'index')) {
      this._askForUnboxing(viewableItems.map(i => i.item))
    }
  }, 1000)

  _maxVisible = Math.ceil(Kb.NativeDimensions.get('window').height / 64)

  _setRef = r => {
    this._list = r
  }

  _getItemLayout = (data, index) => {
    // We cache the divider location so we can divide the list into small and large. We can calculate the small cause they're all
    // the same height. We iterate over the big since that list is small and we don't know the number of channels easily
    const smallHeight = RowSizes.smallRowHeight
    if (index < this._dividerIndex || this._dividerIndex === -1) {
      const offset = index ? smallHeight * index : 0
      const length = smallHeight
      return {index, length, offset}
    }

    const dividerHeight = RowSizes.dividerHeight(this._dividerShowButton)
    if (index === this._dividerIndex) {
      const offset = smallHeight * index
      const length = dividerHeight
      return {index, length, offset}
    }

    let offset = smallHeight * this._dividerIndex + dividerHeight
    let i = this._dividerIndex + 1

    for (; i < index; ++i) {
      const h = data[i].type === 'big' ? RowSizes.bigRowHeight : RowSizes.bigHeaderHeight
      offset += h
    }
    const length = data[i].type === 'big' ? RowSizes.bigRowHeight : RowSizes.bigHeaderHeight
    return {index, length, offset}
  }

  render() {
    this._dividerShowButton = false
    this._dividerIndex = this.props.rows.findIndex(r => {
      if (r.type === 'divider') {
        this._dividerShowButton = r.showButton
        return true
      }
      return false
    })

    const noChats = !this.props.neverLoaded && !this.props.isSearching && !this.props.rows.length && (
      <NoChats onNewChat={this.props.onNewChat} />
    )
    const floatingDivider = this.state.showFloating &&
      !this.props.isSearching &&
      this.props.allowShowFloatingButton && <BigTeamsDivider toggle={this.props.toggleSmallTeamsExpanded} />
    const HeadComponent = <ChatInboxHeader />
    return (
      <Kb.ErrorBoundary>
        <Kb.Box style={styles.container}>
          {this.props.isSearching ? (
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <InboxSearch header={HeadComponent} />
            </Kb.Box2>
          ) : (
            <Kb.NativeFlatList
              ListHeaderComponent={HeadComponent}
              data={this.props.rows}
              keyExtractor={this._keyExtractor}
              renderItem={this._renderItem}
              ref={this._setRef}
              onViewableItemsChanged={this._onViewChanged}
              windowSize={5}
              keyboardShouldPersistTaps="handled"
              getItemLayout={this._getItemLayout}
            />
          )}
          {noChats}
          {floatingDivider || (!this.props.isSearching && <BuildTeam />)}
          {this.state.showUnread && !this.props.isSearching && !this.state.showFloating && (
            <UnreadShortcut onClick={this._scrollToUnread} />
          )}
        </Kb.Box>
      </Kb.ErrorBoundary>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    backgroundColor: Styles.globalColors.fastBlank,
    flex: 1,
    position: 'relative',
  },
  text: {
    color: Styles.globalColors.black_50,
  },
})

export default Inbox
export type RowItem = T.RowItem
export type RowItemSmall = T.RowItemSmall
