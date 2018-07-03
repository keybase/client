// @flow
import React, {Component} from 'react'
import {Box, Checkbox, Button, Text, Icon, Box2, HeaderHocHeader} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins, styleSheetCreate} from '../../styles'
import {getStyle} from '../../common-adapters/text'
import type {Props} from '.'

type State = {
  checked: boolean,
}

class SuccessRender extends Component<Props, State> {
  state = {
    checked: false,
  }

  render() {
    return (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <HeaderHocHeader onBack={this.props.onBack} headerStyle={styles.header} />
        <Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true} gap="small">
          <Text type="Header" style={styles.textCenter}>
            {this.props.title || "Congratulations, you've just joined Keybase!"}
          </Text>
          <Text type="Body" style={styles.textCenterMargin}>
            Here is your unique paper key, it will allow you to perform important Keybase tasks in the future.
            This is the only time you'll see this so be sure to write it down.
          </Text>

          <Box style={styles.paperKeyContainer}>
            <Text type="Header" selectable={true} style={styles.paperkey}>
              {this.props.paperkey.stringValue()}
            </Text>
            <Box style={styles.paperCorner}>
              <Icon type="icon-paper-key-corner" />
            </Box>
          </Box>

          <Checkbox
            label="Yes, I wrote this down."
            checked={this.state.checked}
            onCheck={checked => this.setState({checked})}
          />

          <Button
            disabled={!this.state.checked}
            onClick={this.props.onFinish}
            label="Done"
            type="Primary"
            style={{marginTop: globalMargins.small}}
          />
        </Box2>
      </Box2>
    )
  }
}

const styles = styleSheetCreate({
  header: {position: 'absolute'},
  paperCorner: {
    position: 'absolute',
    right: -4,
    top: -4,
  },
  paperKeyContainer: {
    alignSelf: 'center',
    backgroundColor: globalColors.white,
    borderColor: globalColors.darkBlue,
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 4,
    marginBottom: globalMargins.medium,
    marginTop: globalMargins.small,
    paddingBottom: globalMargins.small,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.large,
    paddingTop: globalMargins.small,
  },
  paperkey: {
    ...getStyle('Header', 'Normal'),
    ...globalStyles.fontTerminal,
    color: globalColors.darkBlue,
    textAlign: 'center',
  },
  textCenter: {
    textAlign: 'center',
  },
  textCenterMargin: {
    marginTop: globalMargins.medium,
    textAlign: 'center',
  },
})

export default SuccessRender
