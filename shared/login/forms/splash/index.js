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
      Send us feedback! Run{' '}
      <Text type="TerminalInline" selectable={true}>
        keybase log send
      </Text>{' '}
      from the terminal.
    </Text>
  )

class Splash extends React.Component<Props, State> {
  state = {
    showFeedback: false,
  }

  componentDidMount() {
    console.log('nathan-testing', 'did mount')
    console.log('nathan-testing', this.props, '(props)')
    console.log('nathan-testing', this.state, '(did mount state)')

    if (!__STORYBOOK__) {
      console.log('nathan-testing', 'start timeout')
      this.props.setTimeout(() => {
        console.log('nathan-testing', this.state, '(before timeout setState)')
        console.log('nathan-testing', 'execute timeout')
        console.log('nathan-testing', this.state, '(after timeout setState)')
        this.setState({showFeedback: true})
      }, 4000)
    }
  }

  componentWillUnmount() {
    console.log('nathan-testing', 'will unmount')
    console.log('nathan-testing', this.state)
  }

  render() {
    console.log('nathan-testing', 'render')
    console.log('nathan-testing', this.state, '(during render)')

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
