/* eslint-env browser */
//
// Infinite scrolling list.
// We group messages into a series of Waypoints. When the wayoint exits the screen we replace it with a single div instead
// We use react-measure to cache the heights
import * as React from 'react'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/chat2'
import JumpToRecent from './jump-to-recent'
import Measure from 'react-measure'
import Message from '../messages'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import logger from '../../../logger'
import shallowEqual from 'shallowequal'
import {ErrorBoundary} from '../../../common-adapters'
import {Props} from '.'
import {Waypoint} from 'react-waypoint'
import debounce from 'lodash/debounce'
import throttle from 'lodash/throttle'
import chunk from 'lodash/chunk'
import {globalMargins} from '../../../styles/shared'
import {memoize} from '../../../util/memoize'

// hot reload isn't supported with debouncing currently so just ignore hot here
if (module.hot) {
  module.hot.decline()
}

const ordinalsInAWaypoint = 10
// pixels away from top/bottom to load/be locked
const listEdgeSlop = 10

const scrollOrdinalKey = 'scroll-ordinal-key'

type State = {}

type Snapshot = {
  scrollHeight: number
  scrollTop: number
}

const debug = __STORYBOOK__

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

class Thread extends React.PureComponent<Props, State> {
  state = {}
  private listRef = React.createRef<HTMLDivElement>()
  private listContents = React.createRef<HTMLDivElement>()
  // so we can turn pointer events on / off
  private pointerWrapperRef = React.createRef<HTMLDivElement>()
  // Not a state so we don't rerender, just mutate the dom
  private isScrolling = false

  private lastResizeHeight = 0
  private resizeObserver =
    // @ts-ignore doesn't know about ResizeObserver
    typeof ResizeObserver !== 'undefined' &&
    // @ts-ignore doesn't know about ResizeObserver
    new ResizeObserver((entries: Array<{contentRect: {height: number}}>) => {
      const entry = entries[0]
      const {contentRect} = entry
      const {height} = contentRect
      if (height !== this.lastResizeHeight) {
        this.lastResizeHeight = height
        if (this.isLockedToBottom()) {
          this.scrollToBottom('resize observed')
        }
      }
    })

  private _lockedToBottom: boolean = true
  get lockedToBottom() {
    return this._lockedToBottom
  }
  set lockedToBottom(l: boolean) {
    // accessor just to help debug
    this._lockedToBottom = l
  }

  private logAll = debug
    ? (list: HTMLDivElement, name: string, fn: any) => {
        const oldScrollTop = list.scrollTop
        const oldScrollHeight = list.scrollHeight
        const oldClientHeight = list.clientHeight
        fn()
        logger.debug(
          'SCROLL',
          name,
          'scrollTop',
          oldScrollTop,
          '->',
          list.scrollTop,
          'scrollHeight',
          oldScrollHeight,
          '->',
          list.scrollHeight,
          'clientHeight',
          oldClientHeight,
          '->',
          list.clientHeight
        )
      }
    : (_: HTMLDivElement, __: string, fn: any) => fn()

  private scrollToCentered = () => {
    const list = this.listRef.current
    if (list) {
      this.logAll(list, `scrollToCentered()`, () => {
        // grab the waypoint we made for the centered ordinal and scroll to it
        const scrollWaypoint = list.querySelectorAll(`[data-key=${scrollOrdinalKey}]`)
        if (scrollWaypoint.length > 0) {
          scrollWaypoint[0].scrollIntoView({block: 'center', inline: 'nearest'})
        }
      })
    }
  }

  private isLockedToBottom = () => {
    // if we don't have the latest message, we can't be locked to the bottom
    return this.lockedToBottom && this.props.containsLatestMessage
  }

  private scrollToBottom = (reason: string) => {
    const actuallyScroll = () => {
      const list = this.listRef.current
      if (list) {
        this.logAll(list, `scrollToBottom(${reason})`, () => {
          this.adjustScrollAndIgnoreOnScroll(() => {
            list.scrollTop = list.scrollHeight - list.clientHeight
          })
        })
      }
    }

    actuallyScroll()
    setTimeout(() => {
      requestAnimationFrame(actuallyScroll)
    }, 1)
  }

  private scrollDown = () => {
    const list = this.listRef.current
    if (list) {
      this.logAll(list, 'scrollDown', () => {
        this.adjustScrollAndIgnoreOnScroll(() => {
          list.scrollTop += list.clientHeight
        })
      })
    }
  }

  private scrollUp = () => {
    this._lockedToBottom = false
    const list = this.listRef.current
    if (list) {
      this.logAll(list, 'scrollUp', () => {
        this.adjustScrollAndIgnoreOnScroll(() => {
          list.scrollTop -= list.clientHeight
          this.checkForLoadMoreThrottled()
        })
      })
    }
  }

  private jumpToRecent = () => {
    this.lockedToBottom = true
    this.scrollToBottom('jump to recent')
    this.props.onJumpToRecent()
  }

  componentDidMount() {
    if (!markedInitiallyLoaded) {
      markedInitiallyLoaded = true
      this.props.markInitiallyLoadedThreadAsRead()
    }
    if (this.props.centeredOrdinal) {
      this.lockedToBottom = false
      this.scrollToCentered()
      return
    }
    if (this.isLockedToBottom()) {
      this.scrollToBottom('componentDidMount')
    }
  }

  getSnapshotBeforeUpdate(prevProps: Props) {
    // prepending, lets keep track of the old scrollHeight
    if (
      this.props.conversationIDKey === prevProps.conversationIDKey &&
      this.props.messageOrdinals[0] !== prevProps.messageOrdinals[0] &&
      prevProps.messageOrdinals[0]
    ) {
      const {current} = this.listRef

      return {scrollHeight: current ? current.scrollHeight : 0, scrollTop: current ? current.scrollTop : 0}
    }
    return null
  }

  componentDidUpdate(prevProps: Props, _: State, snapshot: Snapshot) {
    if (this.props === prevProps) {
      // don't do any of the below if just state changes
      return
    }

    // this.checkResized()

    // conversation changed
    if (this.props.conversationIDKey !== prevProps.conversationIDKey) {
      this.cleanupDebounced()
      this.lockedToBottom = true
      this.scrollToBottom('componentDidUpdate-change-convo')
      return
    }

    // someone requested we scroll down
    if (this.props.scrollListDownCounter !== prevProps.scrollListDownCounter) {
      this.scrollDown()
      return
    }

    // someone requested we scroll up
    if (this.props.scrollListUpCounter !== prevProps.scrollListUpCounter) {
      this.scrollUp()
      return
    }

    // someone requested we scroll to bottom and lock (ignore if we don't have latest)
    if (
      this.props.scrollListToBottomCounter !== prevProps.scrollListToBottomCounter &&
      this.props.containsLatestMessage
    ) {
      this.lockedToBottom = true
      this.scrollToBottom('componentDidUpdate-requested')
      return
    }

    // Adjust scrolling if locked to the bottom
    const list = this.listRef.current

    // Check if we just added new messages from the future. In this case, we don't want to adjust scroll
    // position at all, so just bail out if we detect this case.
    if (
      this.props.messageOrdinals.length !== prevProps.messageOrdinals.length &&
      this.props.messageOrdinals[0] === prevProps.messageOrdinals[0]
    ) {
      // do nothing do scroll position if this is true
      return
    }

    // Check to see if our centered ordinal has changed, and if so, scroll to it
    if (!!this.props.centeredOrdinal && this.props.centeredOrdinal !== prevProps.centeredOrdinal) {
      this.lockedToBottom = false
      this.scrollToCentered()
      return
    }

    // Are we prepending older messages?
    if (snapshot && snapshot.scrollHeight && list && !this.isLockedToBottom()) {
      requestAnimationFrame(() => {
        const {current} = this.listRef
        if (current) {
          const fromBottom = snapshot.scrollHeight - snapshot.scrollTop
          current.scrollTop = current.scrollHeight - fromBottom
        }
      })
    }
    if (list && this.props.editingOrdinal && this.props.editingOrdinal !== prevProps.editingOrdinal) {
      const ordinal = this.props.editingOrdinal
      const idx = this.props.messageOrdinals.indexOf(ordinal)
      if (idx !== -1) {
        const waypoints = list.querySelectorAll('[data-key]')
        // find an id that should be our parent
        const toFind = Types.ordinalToNumber(ordinal)
        const found = (Array.from(waypoints) as Array<HTMLElement>).reverse().find(w => {
          const key = w.dataset.key
          return key !== undefined && parseInt(key, 10) < toFind
        })
        if (found) {
          found.scrollIntoView({behavior: 'smooth', block: 'center'})
        }
      }
    }
  }

  componentWillUnmount() {
    this.cleanupDebounced()
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = undefined
    }
  }

  private cleanupDebounced = () => {
    this.onAfterScroll.cancel()
    this.onScrollThrottled.cancel()
    this.checkForLoadMoreThrottled.cancel()
  }

  private ignoreOnScroll = false
  private adjustScrollAndIgnoreOnScroll = (fn: () => void) => {
    this.ignoreOnScroll = true
    fn()
  }

  private onScroll = () => {
    if (this.ignoreOnScroll) {
      this.ignoreOnScroll = false
      return
    }
    // quickly set to false to assume we're not locked. if we are the throttled one will set it to true
    this.lockedToBottom = false
    this.checkForLoadMoreThrottled()
    this.onScrollThrottled()
  }

  // While scrolling we disable mouse events to speed things up. We avoid state so we don't re-render while doing this
  private onScrollThrottled = throttle(
    () => {
      const list = this.listRef.current
      if (list && debug) {
        logger.debug('SCROLL', 'onScrollThrottled', 'scrollTop', list.scrollTop)
      }

      if (!this.isScrolling) {
        this.isScrolling = true
        if (this.pointerWrapperRef.current) {
          this.pointerWrapperRef.current.style.pointerEvents = 'none'
        }
      }
      this.onAfterScroll()
    },
    100,
    {leading: true, trailing: true}
  )

  private checkForLoadMoreThrottled = throttle(
    () => {
      // are we at the top?
      const list = this.listRef.current
      if (list) {
        if (list.scrollTop < listEdgeSlop) {
          this.props.loadOlderMessages()
        } else if (
          !this.props.containsLatestMessage &&
          !this.isLockedToBottom() &&
          list.scrollTop > list.scrollHeight - list.clientHeight - listEdgeSlop
        ) {
          this.props.loadNewerMessages()
        }
      }
    },
    100,
    // trailing = true cause you can be on top but keep scrolling which can keep the throttle going and ultimately miss out
    // on scrollTop being zero and not trying to load more
    {leading: true, trailing: true}
  )

  // After lets turn them back on
  private onAfterScroll = debounce(() => {
    if (this.isScrolling) {
      this.isScrolling = false
      if (this.pointerWrapperRef.current) {
        this.pointerWrapperRef.current.style.pointerEvents = 'initial'
      }
    }

    const list = this.listRef.current
    // are we locked on the bottom?
    if (list) {
      if (debug) {
        logger.debug('SCROLL', 'onAfterScroll', 'scrollTop', list.scrollTop)
      }
      this.lockedToBottom = list.scrollHeight - list.clientHeight - list.scrollTop < listEdgeSlop
    }
  }, 200)

  private rowRenderer = (ordinal: Types.Ordinal, previous?: Types.Ordinal) => (
    <Message
      key={String(ordinal)}
      ordinal={ordinal}
      previous={previous}
      conversationIDKey={this.props.conversationIDKey}
    />
  )

  private onCopyCapture = (e: React.BaseSyntheticEvent) => {
    // Copy text only, not HTML/styling.
    e.preventDefault()
    const sel = window.getSelection()
    sel && this.props.copyToClipboard(sel.toString())
  }

  private handleListClick = (ev: React.MouseEvent) => {
    const target = ev.target
    // allow focusing other inner inputs such as the reacji picker filter
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }

    const sel = window.getSelection()
    if (sel && sel.isCollapsed) {
      this.props.onFocusInput()
    }
  }

  private makeItems = () => this.makeItemsMemoized(this.props.conversationIDKey, this.props.messageOrdinals)

  private makeItemsMemoized = memoize(
    (conversationIDKey: Types.ConversationIDKey, messageOrdinals: Array<number>) => {
      const items: Array<React.ReactNode> = []
      items.push(<TopItem key="topItem" conversationIDKey={conversationIDKey} />)

      const numOrdinals = messageOrdinals.length
      let ordinals: Array<Types.Ordinal> = []
      let previous: undefined | Types.Ordinal
      let lastBucket: number | undefined
      let baseIndex = 0 // this is used to de-dupe the waypoint around the centered ordinal
      messageOrdinals.forEach((ordinal, idx) => {
        // Centered ordinal is where we want the view to be centered on when jumping around in the thread.
        const isCenteredOrdinal = ordinal === this.props.centeredOrdinal

        // We want to keep the mapping of ordinal to bucket fixed always
        const bucket = Math.floor(Types.ordinalToNumber(ordinal) / ordinalsInAWaypoint)
        if (lastBucket === undefined) {
          lastBucket = bucket
        }
        const needNextWaypoint = bucket !== lastBucket
        const isLastItem = idx === numOrdinals - 1
        if (needNextWaypoint || isLastItem || isCenteredOrdinal) {
          if (isLastItem && !isCenteredOrdinal) {
            // we don't want to add the centered ordinal here, since it will go into its own waypoint
            ordinals.push(ordinal)
          }
          if (ordinals.length) {
            // don't allow buckets to be too big
            const chunks = chunk(ordinals, 10)
            chunks.forEach((toAdd, cidx) => {
              const key = `${lastBucket || ''}:${cidx + baseIndex}`
              items.push(
                <OrdinalWaypoint
                  key={key}
                  id={key}
                  rowRenderer={this.rowRenderer}
                  ordinals={toAdd}
                  previous={previous}
                />
              )
              previous = toAdd[toAdd.length - 1]
            })
            // we pass previous so the OrdinalWaypoint can render the top item correctly
            ordinals = []
            lastBucket = bucket
          }
        }
        // If this is the centered ordinal, it goes into its own waypoint so we can easily scroll to it
        if (isCenteredOrdinal) {
          items.push(
            <OrdinalWaypoint
              key={scrollOrdinalKey}
              id={scrollOrdinalKey}
              rowRenderer={this.rowRenderer}
              ordinals={[ordinal]}
              previous={previous}
            />
          )
          previous = ordinal
          lastBucket = 0
          baseIndex++ // push this up if we drop the centered ordinal waypoint
        } else {
          ordinals.push(ordinal)
        }
      })

      items.push(<BottomItem key="bottomItem" conversationIDKey={conversationIDKey} />)

      return items
    }
  )

  private setListContents = (listContents: HTMLDivElement | null) => {
    if (!this.resizeObserver) {
      return
    }
    if (this.listContents.current && this.listContents.current !== listContents) {
      this.resizeObserver.unobserve(this.listContents.current)
    }
    if (listContents) {
      this.resizeObserver.observe(listContents)
    }

    // @ts-ignore a violation
    this.listContents.current = listContents
  }

  private setListRef = (list: HTMLDivElement | null) => {
    if (this.listRef.current && this.listRef.current !== list) {
      this.listRef.current.removeEventListener('scroll', this.onScroll)
    }
    if (list) {
      list.addEventListener('scroll', this.onScroll, {passive: true})
    }

    // @ts-ignore a violation
    this.listRef.current = list
  }

  render() {
    const items = this.makeItems()

    const debugInfo = debug ? (
      <div>Debug info: {this.isLockedToBottom() ? 'Locked to bottom' : 'Not locked to bottom'}</div>
    ) : null

    return (
      <ErrorBoundary>
        {debugInfo}
        <div style={styles.container} onClick={this.handleListClick} onCopyCapture={this.onCopyCapture}>
          <style>{realCSS}</style>
          <div key={this.props.conversationIDKey} style={styles.list} ref={this.setListRef}>
            <div style={styles.listContents} ref={this.setListContents}>
              {items}
            </div>
          </div>
          {!this.props.containsLatestMessage && this.props.messageOrdinals.length > 0 && (
            <JumpToRecent onClick={this.jumpToRecent} style={styles.jumpToRecent} />
          )}
        </div>
      </ErrorBoundary>
    )
  }
}

type TopBottomItemProps = {
  conversationIDKey: Types.ConversationIDKey
}

type TopBottomItemState = {
  keyCount: number
}

class TopItem extends React.PureComponent<TopBottomItemProps, TopBottomItemState> {
  state = {keyCount: 0}
  private measure = () => {
    this.setState(p => ({keyCount: p.keyCount + 1}))
  }

  render() {
    return <SpecialTopMessage conversationIDKey={this.props.conversationIDKey} measure={this.measure} />
  }
}

class BottomItem extends React.PureComponent<TopBottomItemProps, TopBottomItemState> {
  state = {keyCount: 0}
  private measure = () => {
    this.setState(p => ({keyCount: p.keyCount + 1}))
  }

  render() {
    return <SpecialBottomMessage conversationIDKey={this.props.conversationIDKey} measure={this.measure} />
  }
}

type OrdinalWaypointProps = {
  id: string
  rowRenderer: (ordinal: Types.Ordinal, previous?: Types.Ordinal, measure?: () => void) => React.ReactNode
  ordinals: Array<Types.Ordinal>
  previous?: Types.Ordinal
}

type OrdinalWaypointState = {
  force: number
}

class OrdinalWaypoint extends React.Component<OrdinalWaypointProps, OrdinalWaypointState> {
  state = {
    force: 0,
  }
  // not state so we can really control the re-rendering
  private height?: number
  private heightForOrdinals: Array<Types.Ordinal> = []
  private isVisible = true
  private width?: number
  private animID?: number

  componentWillUnmount() {
    this.onResize.cancel()
    this.measure.cancel()
    this.cancelAnim()
  }

  private cancelAnim = () => {
    if (this.animID) {
      window.cancelAnimationFrame(this.animID)
      this.animID = 0
    }
  }

  // We ran into an issue where this was being called tremendously fast with inside/below. To stop that behavior
  // we defer settings things invisible for a little bit, which seems enough to fix it
  private handlePositionChange = (p: Waypoint.CallbackArgs) => {
    // lets ignore when this happens, this seems like a large source of jiggliness
    if (this.isVisible && !p.event) {
      return
    }
    const {currentPosition} = p
    if (currentPosition) {
      const isInside = currentPosition === 'inside'
      this.cancelAnim()
      if (isInside) {
        if (!this.isVisible) {
          this.isVisible = true
          this.customForceUpdate()
        }
      } else {
        this.animID = window.requestAnimationFrame(() => {
          this.animID = 0
          if (this.isVisible) {
            this.isVisible = false
            this.customForceUpdate()
          }
        })
      }
    }
  }

  private customForceUpdate = () => {
    // We really want to control when this re-renders. We measure but just need this for bookkeeping and don't want to pay for the second render etc
    // eslint-disable-next-line react/no-access-state-in-setstate
    this.setState({force: this.state.force + 1})
  }

  private onResize = debounce(({bounds}) => {
    const height = Math.ceil(bounds.height)
    const width = Math.ceil(bounds.width)

    if (height && width) {
      let changed = false
      // don't have a width at all or its unchanged
      if (!this.width || this.width === width) {
        if (this.height !== height) {
          this.heightForOrdinals = this.props.ordinals
          this.height = height
          // don't redraw in this case
        }
      } else {
        // toss height if width changes
        this.height = undefined
        changed = true
      }

      if (this.width !== width) {
        if (this.width !== undefined) {
          changed = true
        }
        this.width = width
      }

      if (changed) {
        this.customForceUpdate()
      }
    }
  }, 100)

  private measure = debounce(() => {
    if (this.height !== undefined) {
      this.height = undefined
      // eslint-disable-next-line react/no-access-state-in-setstate
      this.setState({force: this.state.force + 1})
    }
  }, 100)

  shouldComponentUpdate(nextProps: OrdinalWaypointProps, nextState: OrdinalWaypointState) {
    return !shallowEqual(this.state, nextState) || !shallowEqual(this.props.ordinals, nextProps.ordinals)
  }

  // Cache rendered children if the ordinals are the same, else we'll thrash a lot as we scroll up and down
  private lastVisibleChildrenOrdinals: Array<Types.Ordinal> = []
  private lastVisibleChildren: React.ReactNode = null
  render() {
    if (!shallowEqual(this.props.ordinals, this.heightForOrdinals)) {
      this.height = undefined
    }

    // Apply data-key to the dom node so we can search for editing messages
    const renderMessages = !this.height || this.isVisible
    let content: React.ReactNode
    if (renderMessages) {
      if (this.props.ordinals === this.lastVisibleChildrenOrdinals && this.lastVisibleChildren) {
        // cache children to skip re-rendering
        content = this.lastVisibleChildren
      } else {
        const messages = this.props.ordinals.map((o, idx) => {
          const previous = idx ? this.props.ordinals[idx - 1] : this.props.previous
          return this.props.rowRenderer(o, previous, this.measure)
        })
        content = (
          <Measure bounds={true} onResize={this.onResize}>
            {({measureRef}) => (
              <div data-key={this.props.id} ref={measureRef}>
                {messages}
              </div>
            )}
          </Measure>
        )
        this.lastVisibleChildrenOrdinals = this.props.ordinals
        this.lastVisibleChildren = content
      }
    } else {
      content = <div data-key={this.props.id} style={{height: this.height}} />
    }
    return (
      <Waypoint key={this.props.id} onPositionChange={this.handlePositionChange}>
        {content}
      </Waypoint>
    )
  }
}

// We need to use both visibility and opacity css properties for the
// action button hide/show on hover.
// We use opacity because it shows/hides the button immediately on
// hover, while visibility has slight lag.
// We use visibility so that the action button content isn't copied
// during copy/paste actions since user-select isn't working in
// Chrome.
const realCSS = `
.message {
  contain: content;
}
`

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.flexBoxColumn,
          // containment hints so we can scroll faster
          contain: 'strict',
          flex: 1,
          position: 'relative',
        },
      }),
      jumpToRecent: {
        bottom: 0,
        position: 'absolute',
      },
      list: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.fillAbsolute,
          outline: 'none',
          overflowX: 'hidden',
          overflowY: 'auto',
          paddingBottom: globalMargins.small,
          // get our own layer so we can scroll faster
          willChange: 'transform',
        },
      }),
      listContents: {
        width: '100%',
      },
    } as const)
)

export default Thread
