import React, {Component} from 'react'
import logger from '../../logger'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {ignoreDisconnectOverlay} from '../../local-debug.desktop'
import {RPCError} from '../../util/errors'

import {Props as _Props} from './index'

type Size = 'Closed' | 'Small' | 'Big'

type State = {
  size: Size
  cachedSummary?: string
  cachedDetails?: string
}

type Props = Kb.PropsWithTimer<_Props>

class GlobalError extends Component<Props, State> {
  state: State
  timerID?: NodeJS.Timeout
  _mounted: boolean = false

  constructor(props: Props) {
    super(props)

    this.state = {
      cachedDetails: this._detailsForError(props.error),
      cachedSummary: this._summaryForError(props.error),
      size: 'Closed',
    }
  }

  componentWillUnmount() {
    this._mounted = false
  }

  componentDidMount() {
    this._mounted = true
    this._resetError(!!this.props.error)
  }

  _onExpandClick = () => {
    this.setState({size: 'Big'})
    this._clearCountdown()
  }

  _clearCountdown() {
    if (this.timerID) {
      this.props.clearTimeout(this.timerID)
    }
    this.timerID = undefined
  }

  _resetError(newError: boolean) {
    this._clearCountdown()
    this.setState({size: newError ? 'Small' : 'Closed'})

    if (newError) {
      this.timerID = this.props.setTimeout(() => {
        this.props.onDismiss()
      }, 10000)
    }
  }

  _summaryForError(err: null | Error | RPCError) {
    return err ? err.message : undefined
  }

  _detailsForError(err: null | Error | RPCError) {
    return err ? err.stack : undefined
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.error !== this.props.error) {
      this.props.setTimeout(
        () => {
          if (this._mounted) {
            this.setState({
              cachedDetails: this._detailsForError(this.props.error),
              cachedSummary: this._summaryForError(this.props.error),
            })
          }
        },
        this.props.error ? 0 : 7000
      ) // if it's set, do it immediately, if it's cleared set it in a bit
      this._resetError(!!this.props.error)
    }
  }

  static maxHeightForSize(size: Size) {
    return {
      Big: 900,
      Closed: 0,
      Small: 35,
    }[size]
  }

  renderDaemonError() {
    if (ignoreDisconnectOverlay) {
      logger.warn('Ignoring disconnect overlay')
      return null
    }

    const message =
      (this.props.daemonError && this.props.daemonError.message) ||
      'Keybase is currently unreachable. Trying to reconnect you…'
    return (
      <Kb.Box style={styles.containerOverlay}>
        <Kb.Box style={styles.overlayRow}>
          <Kb.Text center={true} type="BodySmallSemibold" style={styles.message}>
            {message}
          </Kb.Text>
        </Kb.Box>
        <Kb.Box style={styles.overlayFill}>
          <Kb.Icon type="icon-loader-connecting-266" />
        </Kb.Box>
      </Kb.Box>
    )
  }

  renderError() {
    const {onDismiss} = this.props
    const summary = this.state.cachedSummary
    const details = this.state.cachedDetails
    const maxHeight = GlobalError.maxHeightForSize(this.state.size)

    return (
      <Kb.Box
        style={Styles.collapseStyles([styles.container, styles.containerError, {maxHeight}])}
        onClick={this._onExpandClick}
      >
        <Kb.Box style={Styles.collapseStyles([styles.summaryRow, styles.summaryRowError])}>
          <Kb.Text center={true} type="BodyBig" style={styles.summary}>
            {summary}
          </Kb.Text>
          {summary && (
            <Kb.Icon
              color={Styles.globalColors.white_75}
              hoverColor={Styles.globalColors.white}
              onClick={onDismiss}
              style={styles.closeIcon}
              type="iconfont-close"
            />
          )}
        </Kb.Box>
        <Kb.Text center={true} type="BodyBig" selectable={true} style={styles.details}>
          {details}
        </Kb.Text>
      </Kb.Box>
    )
  }

  render() {
    if (this.props.daemonError) {
      return this.renderDaemonError()
    }
    return this.renderError()
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      closeIcon: Styles.platformStyles({
        isElectron: {
          position: 'absolute',
          right: Styles.globalMargins.xsmall,
          top: Styles.globalMargins.xsmall,
        },
      }),
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        left: 0,
        overflow: 'hidden',
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 1000,
      },
      containerError: {
        ...Styles.transition('max-height'),
      },
      containerOverlay: {
        ...Styles.globalStyles.flexBoxColumn,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 1000,
      },
      details: {
        backgroundColor: Styles.globalColors.black,
        color: Styles.globalColors.white_75,
        padding: 8,
        paddingLeft: Styles.globalMargins.xlarge,
        paddingRight: Styles.globalMargins.xlarge,
      },
      message: {
        color: Styles.globalColors.white,
      },
      overlayFill: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.white,
        flex: 1,
        justifyContent: 'center',
      },
      overlayRow: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.blue,
        justifyContent: 'center',
        padding: 8,
      },
      summary: {
        color: Styles.globalColors.white,
        flex: 1,
      },
      summaryRow: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        padding: 8,
        position: 'relative',
      },
      summaryRowError: {
        backgroundColor: Styles.globalColors.black,
        minHeight: GlobalError.maxHeightForSize('Small'),
      },
    } as const)
)

export default Kb.HOCTimers(GlobalError)
