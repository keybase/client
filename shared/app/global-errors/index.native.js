// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import {RPCError} from '../../util/errors'
import type {Props as _Props} from './index.types'

type Size = 'Closed' | 'Small' | 'Big'
type State = {
  size: Size,
  cachedSummary: ?string,
  cachedDetails: ?string,
}

type Props = Kb.PropsWithTimer<_Props>

class GlobalError extends React.Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)

    this.state = {
      cachedDetails: this._detailsForError(props.error),
      cachedSummary: this._summaryForError(props.error),
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
    this.setState({size: newError ? 'Small' : 'Closed'})
  }

  _summaryForError(err: null | Error | RPCError): ?string {
    return err ? err.message : null
  }

  _detailsForError(err: null | Error | RPCError): ?string {
    return err ? err.stack : null
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.error !== this.props.error) {
      this.props.setTimeout(() => {
        this.setState({
          cachedDetails: this._detailsForError(this.props.error),
          cachedSummary: this._summaryForError(this.props.error),
        })
      }, this.props.error ? 0 : 7000) // if it's set, do it immediately, if it's cleared set it in a bit
      this._resetError(!!this.props.error)
    }
  }

  _renderItem = (index: number, item: string) => {
    return (
      <Kb.Text key={String(index)} type="BodySmall" style={{color: 'white', fontSize: 8, lineHeight: 8}}>
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
      <Kb.Box2 direction="vertical" style={styles.container}>
        <Kb.SafeAreaViewTop style={{flexGrow: 0, backgroundColor: Styles.globalColors.transparent}} />
        <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
          <Kb.Box
            style={{
              ...summaryRowStyle,
              paddingBottom: Styles.globalMargins.xtiny,
              position: 'relative',
            }}
          >
            <Kb.Text
              type="BodySmallSemibold"
              style={{color: Styles.globalColors.white, flex: 1, textAlign: 'center'}}
              onClick={this._onExpandClick}
            >
              <Kb.Icon
                type={this.state.size === 'Big' ? 'iconfont-caret-down' : 'iconfont-caret-right'}
                color={Styles.globalColors.white_75}
              />
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
          <Kb.Box style={summaryRowStyle}>
            <Kb.Button
              backgroundMode="Terminal"
              fullWidth={true}
              label="Please tell us"
              onClick={this.props.onFeedback}
              small={true}
              style={{width: '100%'}}
              type="Secondary"
            />
          </Kb.Box>
        </Kb.Box>
        {this.state.size === 'Big' && (
          <Kb.NativeScrollView>
            <Kb.Text type="BodySmall" selectable={true} style={detailStyle}>
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

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.black_75,
    position: 'absolute',
    top: 0,
  },
})

const summaryRowStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  flexShrink: 0,
  justifyContent: 'flex-start',
  paddingBottom: Styles.globalMargins.tiny,
  paddingLeft: Styles.globalMargins.xsmall,
  paddingRight: Styles.globalMargins.xsmall,
  paddingTop: Styles.globalMargins.tiny,
}

const detailStyle = {
  color: Styles.globalColors.white_75,
  fontSize: 14,
  lineHeight: 19,
  padding: Styles.globalMargins.xtiny,
  paddingTop: Styles.globalMargins.tiny,
}

export default Kb.HOCTimers(GlobalError)
