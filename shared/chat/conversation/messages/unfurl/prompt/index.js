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
      <Kb.Box2 style={styles.container}>
        <Kb.Box2 direction="vertical" style={styles.choiceContainer}>
          <Kb.Text type="BodySemibold">Would you like to post a preview?</Kb.Text>
          <Kb.Text type="Body">Your Keybase app will visit the link and post a preview of it.</Kb.Text>
          <Kb.Text onClick={this.props.onAlways} type="BodyPrimaryLink">
            Always for any site.
          </Kb.Text>
          <Kb.Text onClick={this.props.onAccept} type="BodyPrimaryLink">
            Always, for {this.props.domain}.
          </Kb.Text>
          <Kb.Text onClick={this.props.onNownow} type="BodyPrimaryLink">
            Not now.
          </Kb.Text>
          <Kb.Text onClick={this.props.onNever} type="BodyPrimaryLink">
            Never, for any site.
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2 fullHeight={true} style={styles.closeContainer}>
          <Kb.Icon type="iconfont-close" onClick={this.props.onNotnow} fontSize={16} />
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    backgroundColor: Styles.globalColors.blue5,
    borderRadius: Styles.borderRadius,
    paddingTop: 8,
    paddingBottom: 8,
    width: 400,
  },
  choiceContainer: {
    width: 370,
  },
  closeContainer: {
    width: 30,
  },
})

export default UnfurlPrompt
