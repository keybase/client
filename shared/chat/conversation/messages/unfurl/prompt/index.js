// @flow
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

const promptIcon = Styles.isMobile
  ? 'icon-fancy-unfurl-preview-mobile-128-128'
  : 'icon-fancy-unfurl-preview-desktop-96-96'

class UnfurlPrompt extends React.PureComponent<Props> {
  render() {
    return (
      <Kb.Box2 direction="horizontal" style={styles.container}>
        <Kb.Icon type={promptIcon} style={Kb.iconCastPlatformStyles(styles.icon)} />
        <Kb.Box2 direction="vertical" style={styles.choiceContainer}>
          <Kb.Text type="BodySemibold">Would you like to post a preview?</Kb.Text>
          <Kb.Text type="Body">Your Keybase app will visit the link and post a preview of it.</Kb.Text>
          <Kb.Text onClick={this.props.onAlways} type="BodyPrimaryLink">
            Always for any site.
          </Kb.Text>
          <Kb.Text onClick={this.props.onAccept} type="BodyPrimaryLink">
            Always, for {this.props.domain}.
          </Kb.Text>
          <Kb.Text onClick={this.props.onNotnow} type="BodyPrimaryLink">
            Not now.
          </Kb.Text>
          <Kb.Text onClick={this.props.onNever} type="BodyPrimaryLink">
            Never, for any site.
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" style={styles.closeContainer}>
          <Kb.Icon type="iconfont-close" onClick={this.props.onNotnow} fontSize={16} />
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      backgroundColor: Styles.globalColors.blue5,
      borderRadius: Styles.borderRadius,
    },
    isElectron: {
      paddingTop: 8,
      paddingBottom: 8,
      maxWidth: 600,
    },
  }),
  choiceContainer: Styles.platformStyles({
    isElectron: {
      width: 370,
    },
  }),
  closeContainer: Styles.platformStyles({
    isElectron: {
      width: 30,
      marginLeft: 'auto',
      alignSelf: 'flex-start',
    },
  }),
  icon: Styles.platformStyles({
    isElectron: {
      alignSelf: 'center',
      marginRight: 16,
      marginLeft: 16,
    },
  }),
})

export default UnfurlPrompt
