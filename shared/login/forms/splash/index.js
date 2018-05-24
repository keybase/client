// @flow
import * as React from 'react'
import {Text, Icon, Box2, ButtonBar, Button} from '../../../common-adapters'
import {globalColors, styleSheetCreate} from '../../../styles'

type Props = {|
  status: string,
  onRetry: ?() => void,
  onFeedback: ?() => void,
|}

const Feedback = ({onFeedback}) =>
  onFeedback ? (
    <ButtonBar>
      <Button type="Secondary" label="Send us feedback" onClick={onFeedback} />
    </ButtonBar>
  ) : (
    <Text type="BodySmall">
      Send us feedback: Run <Text type="TerminalInline">keybase log</Text> from the terminal
    </Text>
  )

const Splash = (props: Props) => (
  <Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container} gap="small">
    <Icon type="icon-keybase-logo-80" />
    <Text style={styles.header} type="HeaderBig">
      Keybase
    </Text>
    <Text type="BodySmall">{props.status}</Text>
    {props.onRetry && (
      <ButtonBar>
        <Button type="Primary" label="Reload" onClick={props.onRetry} />
      </ButtonBar>
    )}
    {props.onRetry && <Feedback onFeedback={props.onFeedback} />}
  </Box2>
)

const styles = styleSheetCreate({
  container: {alignItems: 'center', justifyContent: 'center'},
  header: {color: globalColors.orange},
})

export default Splash
