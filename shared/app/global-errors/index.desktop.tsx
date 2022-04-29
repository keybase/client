import React, {Component} from 'react'
import logger from '../../logger'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {ignoreDisconnectOverlay} from '../../local-debug.desktop'
import type {RPCError} from '../../util/errors'
import type {Props} from './index'

type Size = 'Closed' | 'Small' | 'Big'

type State = {
  size: Size
  cachedSummary?: string
  cachedDetails?: string
}

class GlobalError extends Component<Props, State> {
  state: State
  private timerID?: ReturnType<typeof setInterval>
  private mounted: boolean = false

  constructor(props: Props) {
    super(props)

    this.state = {
      cachedDetails: this.detailsForError(props.error),
      cachedSummary: this.summaryForError(props.error),
      size: 'Closed',
    }
  }

  componentWillUnmount() {
    this.mounted = false
    this.clearCountdown()
  }

  componentDidMount() {
    this.mounted = true
    this.resetError(!!this.props.error)
  }

  private onExpandClick = () => {
    this.setState({size: 'Big'})
    this.clearCountdown()
  }

  private clearCountdown() {
    if (this.timerID) {
      clearTimeout(this.timerID)
    }
    this.timerID = undefined
  }

  private resetError(newError: boolean) {
    this.clearCountdown()
    this.setState({size: newError ? 'Small' : 'Closed'})

    if (newError) {
      this.timerID = setTimeout(() => {
        this.props.onDismiss()
      }, 10000)
    }
  }

  private summaryForError(err?: Error | RPCError) {
    return err?.message
  }

  private detailsForError(err?: Error | RPCError) {
    return err?.stack
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.error !== this.props.error) {
      setTimeout(
        () => {
          if (this.mounted) {
            this.setState({
              cachedDetails: this.detailsForError(this.props.error),
              cachedSummary: this.summaryForError(this.props.error),
            })
          }
        },
        this.props.error ? 0 : 7000
      ) // if it's set, do it immediately, if it's cleared set it in a bit
      this.resetError(!!this.props.error)
    }
  }

  static maxHeightForSize(size: Size) {
    return {
      Big: 900,
      Closed: 0,
      Small: 35,
    }[size]
  }

  private renderDaemonError() {
    if (ignoreDisconnectOverlay) {
      logger.warn('Ignoring disconnect overlay')
      return null
    }

    const message =
      this.props.daemonError?.message || 'Keybase is currently unreachable. Trying to reconnect you…'
    return (
      <Kb.Box style={styles.containerOverlay}>
        <Kb.Box style={styles.overlayRow}>
          <Kb.Text center={true} type="BodySmallSemibold" style={styles.message}>
            {message}
          </Kb.Text>
        </Kb.Box>
        <Kb.Box style={styles.overlayFill}>
          <Kb.Animation animationType="disconnected" height={175} width={600} />
        </Kb.Box>
      </Kb.Box>
    )
  }

  private renderError() {
    const {onDismiss} = this.props
    const summary = this.state.cachedSummary
    const details = this.state.cachedDetails

    let stylesContainer: Styles.StylesCrossPlatform
    switch (this.state.size) {
      case 'Big':
        stylesContainer = styles.containerBig
        break
      case 'Closed':
        stylesContainer = styles.containerClosed
        break
      case 'Small':
        stylesContainer = styles.containerSmall
        break
    }

    return (
      <Kb.Box style={stylesContainer} onClick={this.onExpandClick}>
        <Kb.Box style={styles.innerContainer}>
          <Kb.Text center={true} type="BodyBig" style={styles.summary}>
            {summary}
          </Kb.Text>
          <Kb.Button
            label="Please tell us"
            onClick={this.props.onFeedback}
            small={true}
            type="Dim"
            style={styles.feedbackButton}
          />
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
        <Kb.ScrollView>
          <Kb.Text center={true} type="BodyBig" selectable={true} style={styles.details}>
            {details}
          </Kb.Text>
        </Kb.ScrollView>
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

const containerBase = {
  ...Styles.globalStyles.flexBoxColumn,
  left: 0,
  overflow: 'hidden',
  position: 'absolute',
  right: 0,
  top: 0,
  zIndex: 1000,
  ...Styles.transition('max-height'),
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      closeIcon: Styles.platformStyles({
        isElectron: {
          position: 'absolute',
          right: Styles.globalMargins.xsmall,
          top: 10,
        },
      }),
      containerBig: {...containerBase, maxHeight: GlobalError.maxHeightForSize('Big')},
      containerClosed: {...containerBase, maxHeight: GlobalError.maxHeightForSize('Closed')},
      containerOverlay: {
        ...Styles.globalStyles.flexBoxColumn,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 1000,
      },
      containerSmall: {...containerBase, maxHeight: GlobalError.maxHeightForSize('Small')},
      details: {
        backgroundColor: Styles.globalColors.black,
        color: Styles.globalColors.white_75,
        padding: 8,
        paddingLeft: Styles.globalMargins.xlarge,
        paddingRight: Styles.globalMargins.xlarge,
      },
      feedbackButton: {
        marginRight: Styles.globalMargins.large,
      },
      innerContainer: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.black,
        flex: 1,
        justifyContent: 'center',
        minHeight: GlobalError.maxHeightForSize('Small'),
        padding: Styles.globalMargins.xtiny,
        position: 'relative',
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
        padding: Styles.globalMargins.xtiny,
        position: 'relative',
      },
      summaryRowError: {
        backgroundColor: Styles.globalColors.black,
        minHeight: GlobalError.maxHeightForSize('Small'),
      },
    } as const)
)

export default GlobalError
