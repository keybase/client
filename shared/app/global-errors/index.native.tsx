import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import {RPCError} from '../../util/errors'
import {Props as _Props} from './index'

type Size = 'Closed' | 'Small' | 'Big'

type State = {
  size: Size
  cachedDetails?: string
}

type Props = Kb.PropsWithTimer<_Props>

class GlobalError extends React.Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)

    this.state = {
      cachedDetails: this._detailsForError(props.error),
      size: 'Closed',
    }
  }

  componentDidMount() {
    this._resetError(!!this.props.error)
  }

  _onExpandClick = () => {
    this.setState({size: 'Big'})
  }

  _resetError(newError: boolean) {
    const size = newError ? 'Small' : 'Closed'
    if (this.state.size !== size) {
      this.setState({size})
    }
  }

  _detailsForError(err: null | Error | RPCError) {
    return err ? err.stack : undefined
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.error !== this.props.error) {
      this.props.setTimeout(
        () => {
          this.setState({
            cachedDetails: this._detailsForError(this.props.error),
          })
        },
        this.props.error ? 0 : 7000
      ) // if it's set, do it immediately, if it's cleared set it in a bit
      this._resetError(!!this.props.error)
    }
  }

  _renderItem = (index: number, item: string) => {
    return (
      <Kb.Text key={String(index)} type="BodySmall" style={styles.itemText}>
        {item}
        {'\n'}
      </Kb.Text>
    )
  }

  render() {
    if (this.state.size === 'Closed') {
      return null
    }

    const {onDismiss} = this.props
    const details = this.state.cachedDetails

    return (
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([
          styles.container,
          this.state.size === 'Big' && Styles.globalStyles.fillAbsolute,
        ])}
      >
        <Kb.SafeAreaViewTop style={styles.safeAreaView} />
        <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
          <Kb.Box style={Styles.collapseStyles([styles.summaryRow, styles.errorTextContainer])}>
            <Kb.Text
              center={true}
              type="BodySmallSemibold"
              style={styles.errorText}
              onClick={this._onExpandClick}
            >
              {this.state.size !== 'Big' && (
                <Kb.Icon type="iconfont-caret-right" color={Styles.globalColors.white_75} sizeType="Tiny" />
              )}
              {'  '}
              An error occurred.
            </Kb.Text>
            <Kb.Icon
              type="iconfont-close"
              onClick={onDismiss}
              color={Styles.globalColors.white_75}
              fontSize={21}
            />
          </Kb.Box>
          <Kb.Box style={styles.summaryRow}>
            <Kb.Button
              fullWidth={true}
              label="Please tell us"
              onClick={this.props.onFeedback}
              small={true}
              type="Dim"
            />
          </Kb.Box>
        </Kb.Box>
        {this.state.size === 'Big' && (
          <Kb.NativeScrollView>
            <Kb.Text type="BodySmall" selectable={true} style={styles.details}>
              {this.props.error && this.props.error.message}
              {'\n\n'}
              {details}
            </Kb.Text>
          </Kb.NativeScrollView>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Styles.globalColors.black,
        position: 'absolute',
        top: 0,
      },
      details: {
        color: Styles.globalColors.white_75,
        fontSize: 14,
        lineHeight: 19,
        padding: Styles.globalMargins.xtiny,
        paddingTop: Styles.globalMargins.tiny,
      },
      errorText: {
        color: Styles.globalColors.white,
        flex: 1,
      },
      errorTextContainer: {
        paddingBottom: Styles.globalMargins.xtiny,
        position: 'relative',
      },
      itemText: {
        color: Styles.globalColors.white,
        fontSize: 8,
        lineHeight: 8,
      },
      safeAreaView: {
        backgroundColor: Styles.globalColors.transparent,
        flexGrow: 0,
      },
      summaryRow: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'flex-start',
        flexShrink: 0,
        justifyContent: 'flex-start',
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.xsmall,
        paddingTop: Styles.globalMargins.tiny,
      },
    } as const)
)

export default Kb.HOCTimers(GlobalError)
