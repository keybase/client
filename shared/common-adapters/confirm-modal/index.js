// @flow
import * as React from 'react'
import {Box, Box2, Button, ButtonBar, HeaderOrPopup, Icon, Text, WaitingButton} from '..'
import * as Styles from '../../styles'
import type {IconType} from '../icon.constants'

// generally one of icon or header will be given
export type Props = {|
  confirmText?: string,
  content?: React.Node,
  description: string,
  header?: React.Node,
  icon?: IconType,
  onCancel: () => void,
  onConfirm: () => void,
  prompt: string,
  waitingKey?: string,
|}

class _ConfirmModal extends React.Component<Props> {
  render() {
    return (
      <Box style={styles.mobileFlex}>
        <Box2 direction="vertical" style={styles.container}>
          <Box2
            alignItems="center"
            direction="vertical"
            fullWidth={true}
            fullHeight={true}
            style={styles.inner}
          >
            {this.props.icon && (
              <Icon
                boxStyle={styles.icon}
                color={Styles.globalColors.black_50}
                fontSize={Styles.isMobile ? 64 : 48}
                style={styles.icon}
                type={this.props.icon}
              />
            )}
            {this.props.header}
            <Text center={true} style={styles.text} type="HeaderBig">
              {this.props.prompt}
            </Text>
            <Text center={true} style={styles.text} type="Body">
              {this.props.description}
            </Text>
            {this.props.content}
          </Box2>
        </Box2>
        <Box2 direction="horizontal" style={styles.buttonBox}>
          <ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
            {!Styles.isMobile && (
              <Button
                fullWidth={true}
                type="Secondary"
                label="Cancel"
                onClick={this.props.onCancel}
                waitingKey={this.props.waitingKey}
              />
            )}
            <Button
              fullWidth={true}
              type="Danger"
              label={this.props.confirmText || 'Confirm'}
              onClick={this.props.onConfirm}
              waitingKey={this.props.waitingKey}
            />
          </ButtonBar>
        </Box2>
      </Box>
    )
  }
}
const ConfirmModal = HeaderOrPopup(_ConfirmModal)

const styles = Styles.styleSheetCreate({
  buttonBar: Styles.platformStyles({
    isElectron: {
      minHeight: 40,
    },
  }),
  buttonBox: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      padding: Styles.globalMargins.xsmall,
    },
    isElectron: {
      borderRadius: 4,
    },
  }),
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.yellow3,
    },
    isElectron: {
      borderRadius: 4,
      overflow: 'hidden',
      padding: 64,
      width: 560,
    },
    isMobile: {
      flex: 1,
      paddingBottom: 64,
      paddingTop: 64,
      width: '100%',
    },
  }),
  icon: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
  },
  inner: {
    backgroundColor: Styles.globalColors.white,
  },
  mobileFlex: Styles.platformStyles({
    isMobile: {flex: 1},
  }),
  text: {
    color: Styles.globalColors.black_75,
    margin: Styles.globalMargins.small,
  },
})

export default ConfirmModal
