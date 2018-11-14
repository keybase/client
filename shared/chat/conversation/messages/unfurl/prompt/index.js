import * as React from 'react'
import * as Kb from '../../../../../common-adapters/index'
import * as Styles from '../../../../../styles'

export type Props = {
  domain: string,
  onAlways: () => void,
  onAccept: () => void,
  onNotnow: () => void,
  onNever: () => void,
}

class UnfurlPrompt extends React.PureComponent<Props> {
  render() {
    return (
      <Kb.Box2 style={stylesDesktop}>
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodySemibold">Would you like to post a preview?</Kb.Text>
          <Kb.Text type="Body">Your Keybase app will visit the link and post a preview of it.</Kb.Text>
          <Kb.Text type="BodyPrimaryLink">Always for any site.</Kb.Text>
          <Kb.Text type="BodyPrimaryLink">Always, for {this.props.domain}.</Kb.Text>
          <Kb.Text type="BodyPrimaryLink">Not now.</Kb.Text>
          <Kb.Text type="BodyPrimaryLink">Never, for any site.</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const stylesDesktop = {
  ...Styles.globalStyles.flexBoxColumn,
}

export default UnfurlPrompt
