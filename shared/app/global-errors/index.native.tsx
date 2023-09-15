import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as KbMobile from '../../common-adapters/mobile.native'
import type {RPCError} from '../../util/errors'
import type {Props} from './index'

type Size = 'Closed' | 'Small' | 'Big'

type State = {
  size: Size
  cachedDetails?: string
}

class GlobalError extends React.Component<Props, State> {
  state: State
  timerID?: ReturnType<typeof setTimeout>

  constructor(props: Props) {
    super(props)

    this.state = {
      cachedDetails: this.detailsForError(props.error),
      size: 'Closed',
    }
  }

  componentDidMount() {
    this.resetError(!!this.props.error)
  }

  componentWillUnmount() {
    this.timerID && clearTimeout(this.timerID)
  }

  private onExpandClick = () => {
    this.setState({size: 'Big'})
  }

  private resetError(newError: boolean) {
    const size = newError ? 'Small' : 'Closed'
    if (this.state.size !== size) {
      this.setState({size})
    }
  }

  private detailsForError(err?: Error | RPCError) {
    return err ? err.stack : undefined
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.error !== this.props.error) {
      this.timerID = setTimeout(
        () => {
          this.setState({
            cachedDetails: this.detailsForError(this.props.error),
          })
        },
        this.props.error ? 0 : 7000
      ) // if it's set, do it immediately, if it's cleared set it in a bit
      this.resetError(!!this.props.error)
    }
  }

  render() {
    const {onDismiss, onFeedback, error} = this.props
    const {size, cachedDetails} = this.state

    if (size === 'Closed') {
      return null
    }

    return (
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([
          styles.container,
          size === 'Big' && Kb.Styles.globalStyles.fillAbsolute,
        ])}
      >
        <Kb.SafeAreaViewTop style={styles.safeAreaView} />
        <Kb.Box style={Kb.Styles.globalStyles.flexBoxColumn}>
          <Kb.Box style={Kb.Styles.collapseStyles([styles.summaryRow, styles.errorTextContainer])}>
            <Kb.Text
              center={true}
              type="BodySmallSemibold"
              style={styles.errorText}
              onClick={this.onExpandClick}
            >
              {size !== 'Big' && (
                <Kb.Icon
                  type="iconfont-caret-right"
                  color={Kb.Styles.globalColors.white_75}
                  sizeType="Tiny"
                />
              )}
              {'  '}
              An error occurred.
            </Kb.Text>
            <Kb.Icon
              type="iconfont-close"
              onClick={onDismiss}
              color={Kb.Styles.globalColors.white_75}
              fontSize={21}
            />
          </Kb.Box>
          <Kb.Box style={styles.summaryRow}>
            <Kb.Button fullWidth={true} label="Please tell us" onClick={onFeedback} small={true} type="Dim" />
          </Kb.Box>
        </Kb.Box>
        {size === 'Big' && (
          <KbMobile.NativeScrollView>
            <Kb.Text type="BodySmall" selectable={true} style={styles.details}>
              {error?.message}
              {'\n\n'}
              {cachedDetails}
            </Kb.Text>
          </KbMobile.NativeScrollView>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Kb.Styles.globalColors.black,
        position: 'absolute',
        top: 0,
      },
      details: {
        color: Kb.Styles.globalColors.white_75,
        fontSize: 14,
        lineHeight: 19,
        padding: Kb.Styles.globalMargins.xtiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      errorText: {
        color: Kb.Styles.globalColors.white,
        flex: 1,
      },
      errorTextContainer: {
        paddingBottom: Kb.Styles.globalMargins.xtiny,
        position: 'relative',
      },
      itemText: {
        color: Kb.Styles.globalColors.white,
        fontSize: 8,
        lineHeight: 8,
      },
      safeAreaView: {
        backgroundColor: Kb.Styles.globalColors.transparent,
        flexGrow: 0,
      },
      summaryRow: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        flexShrink: 0,
        justifyContent: 'center',
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        paddingRight: Kb.Styles.globalMargins.xsmall,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default GlobalError
