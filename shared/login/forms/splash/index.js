// @flow
import * as React from 'react'
import {Text, Icon, Box2, ButtonBar, Button, type PropsWithTimer, HOCTimers} from '../../../common-adapters'
import {globalColors, styleSheetCreate} from '../../../styles'

type Props = PropsWithTimer<{|
  status: string,
  failed: boolean,
  onRetry: ?() => void,
  onFeedback: ?() => void,
|}>

type State = {|
  showFeedback: boolean,
|}

const Feedback = ({onFeedback}) =>
  onFeedback ? (
    <ButtonBar>
      <Button type="Secondary" label="Send us feedback" onClick={onFeedback} />
    </ButtonBar>
  ) : (
    <Text type="BodySmall">
      Send us feedback: Run <Text type="TerminalInline">keybase log send</Text> from the terminal
    </Text>
  )

class Splash extends React.Component<Props, State> {
  state = {
    showFeedback: false,
  }

  componentDidMount() {
    if (!__STORYBOOK__) {
      this.props.setTimeout(() => {
        this.setState({showFeedback: true})
      }, 4000)
    }
  }

  render() {
    return (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container} gap="small">
        <Icon type={this.props.failed ? 'icon-keybase-logo-logged-out-80' : 'icon-keybase-logo-80'} />
        <Text style={styles.header} type="HeaderBig">
          Keybase
        </Text>
        <Text type="BodySmall">{this.props.status}</Text>
        {this.props.onRetry && (
          <ButtonBar>
            <Button type="Primary" label="Reload" onClick={this.props.onRetry} />
          </ButtonBar>
        )}
        {(this.props.onRetry || this.state.showFeedback) && <Feedback onFeedback={this.props.onFeedback} />}
      </Box2>
    )
  }
}

const styles = styleSheetCreate({
  container: {alignItems: 'center', justifyContent: 'center'},
  header: {color: globalColors.orange},
})

export default HOCTimers(Splash)
