// @flow
import * as React from 'react'
import * as Constants from '../../constants/devices'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  paperkey: string,
  waiting: boolean,
  onBack: () => void,
}

type State = {
  wroteItDown: boolean,
}

class PaperKey extends React.Component<Props, State> {
  state = {wroteItDown: false}

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.HeaderHocHeader onBack={this.props.onBack} headerStyle={styles.header} />
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          centerChildren={true}
          style={styles.container}
          gap="medium"
        >
          <Kb.Text type="Header">Paper key generated!</Kb.Text>
          <Kb.Text type="Body" style={styles.intro}>
            Here is your unique paper key, it will allow you to perform important Keybase tasks in the future.
            This is the only time you'll see this so be sure to write it down.
          </Kb.Text>
          <Kb.Box2 direction="vertical" style={styles.keyBox} centerChildren={true} fullWidth={true}>
            {this.props.paperkey ? (
              <Kb.Text center={true} type="Header" selectable={true} style={styles.text}>
                {this.props.paperkey}
              </Kb.Text>
            ) : (
              <Kb.ProgressIndicator type="Small" />
            )}
            <Kb.Icon type="icon-paper-key-corner" style={Kb.iconCastPlatformStyles(styles.keyBoxCorner)} />
          </Kb.Box2>
          <Kb.Checkbox
            label="Yes, I wrote this down."
            checked={this.state.wroteItDown}
            disabled={this.props.waiting}
            onCheck={wroteItDown => this.setState({wroteItDown})}
          />
          <Kb.WaitingButton
            type="Primary"
            label="Done"
            onClick={this.props.onBack}
            disabled={!this.state.wroteItDown}
            waitingKey={Constants.waitingKey}
          />
        </Kb.Box2>
      </Kb.Box2>
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
  },
})

export default PaperKey
