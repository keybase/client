// @flow
import * as React from 'react'
import {Text, Icon, Box2, ButtonBar, Button} from '../../../common-adapters'
import {globalColors, styleSheetCreate, globalMargins, isMobile} from '../../../styles'

type Props = {
  bannerMessage: ?string,
  onFeedback: ?() => void,
  onLogin: () => void,
  onSignup: () => void,
}

const Feedback = ({onFeedback}) =>
  onFeedback ? (
    <Text type="BodySmallSecondaryLink" onClick={onFeedback}>
      Problems logging in?
    </Text>
  ) : (
    <Text type="BodySmall">
      Send us feedback! Run{' '}
      <Text type="TerminalInline" selectable={true}>
        keybase log send
      </Text>{' '}
      from the terminal.
    </Text>
  )

const Intro = (props: Props) => (
  <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    {!!props.bannerMessage && (
      <Box2 direction="vertical" fullWidth={true} style={styles.banner}>
        <Text type="BodySemibold" style={styles.bannerMessage}>
          {props.bannerMessage}
        </Text>
      </Box2>
    )}
    <Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="large" style={styles.innerContainer}>
      <Box2 direction="vertical" gap="small" style={{alignItems: 'center'}}>
        <Icon type="icon-keybase-logo-80" />
        <Text type="HeaderBig" style={styles.join}>
          Join Keybase
        </Text>
        <ButtonBar noPadding={true}>
          <Button type="Primary" onClick={props.onSignup} label="Create an account" />
        </ButtonBar>
      </Box2>
      <Box2 direction="vertical" gap="tiny">
        <Text type="Body" onClick={props.onLogin}>
          Already on Keybase?
        </Text>
        <ButtonBar noPadding={true}>
          <Button type="Secondary" onClick={props.onLogin} label="Log in" />
        </ButtonBar>
      </Box2>
      <Feedback onFeedback={props.onFeedback} />
    </Box2>
  </Box2>
)

const styles = styleSheetCreate({
  banner: {
    backgroundColor: globalColors.blue,
    justifyContent: 'center',
    minHeight: 40,
    paddingBottom: globalMargins.tiny,
    paddingLeft: isMobile ? globalMargins.small : globalMargins.xlarge,
    paddingRight: isMobile ? globalMargins.small : globalMargins.xlarge,
    paddingTop: globalMargins.tiny,
    position: 'absolute',
  },
  bannerMessage: {color: globalColors.white, textAlign: 'center'},
  innerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? globalMargins.small : globalMargins.large,
  },
  join: {color: globalColors.orange},
})

export default Intro
