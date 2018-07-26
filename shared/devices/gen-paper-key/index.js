// @flow
import * as React from 'react'
import * as Constants from '../../constants/devices'
import * as Common from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  paperkey: string,
  onBack: () => void,
}

type State = {
  wroteItDown: boolean,
}

class PaperKey extends React.Component<Props, State> {
  state = {wroteItDown: false}

  render() {
    return (
      <Common.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Common.HeaderHocHeader onBack={this.props.onBack} headerStyle={styles.header} />
        <Common.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          centerChildren={true}
          style={styles.container}
          gap="medium"
        >
          <Common.Text type="Header">Paper key generated!</Common.Text>
          <Common.Text type="Body" style={styles.intro}>
            Here is your unique paper key, it will allow you to perform important Keybase tasks in the future.
            This is the only time you'll see this so be sure to write it down.
          </Common.Text>
          <Common.Box2 direction="vertical" style={styles.keyBox} centerChildren={true} fullWidth={true}>
            {this.props.paperkey ? (
              <Common.Text type="Header" selectable={true} style={styles.text}>
                {this.props.paperkey}
              </Common.Text>
            ) : (
              <Common.ProgressIndicator type="Small" />
            )}
            <Common.Icon
              type="icon-paper-key-corner"
              style={Common.iconCastPlatformStyles(styles.keyBoxCorner)}
            />
          </Common.Box2>
          <Common.Checkbox
            label="Yes, I wrote this down."
            checked={this.state.wroteItDown}
            onCheck={wroteItDown => this.setState({wroteItDown})}
          />
          <Common.WaitingButton
            type="Primary"
            label="Done"
            onClick={this.props.onBack}
            disabled={!this.state.wroteItDown}
            waitingKey={Constants.waitingKey}
          />
        </Common.Box2>
      </Common.Box2>
    )
  }
}

const borderWidth = 3

const styles = Styles.styleSheetCreate({
  container: {
    alignSelf: 'center',
    maxWidth: Styles.isMobile ? undefined : 560,
    padding: Styles.globalMargins.medium,
  },
  header: {position: 'absolute'},
  intro: {textAlign: 'center'},
  keyBox: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.darkBlue,
    borderRadius: borderWidth,
    borderStyle: 'solid',
    borderWidth,
    minHeight: 100,
    padding: Styles.globalMargins.medium,
    position: 'relative',
  },
  keyBoxCorner: {
    position: 'absolute',
    right: -borderWidth,
    top: -borderWidth,
  },
  text: {
    ...Styles.globalStyles.fontTerminal,
    color: Styles.globalColors.darkBlue,
    textAlign: 'center',
  },
})

export default PaperKey
