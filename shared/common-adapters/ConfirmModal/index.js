// @flow
import * as React from 'react'
import {Box, Box2, Button, ButtonBar, HeaderOrPopup, Icon, Text} from '..'
import * as Styles from '../../styles'
import type {IconType} from '../icon.constants'

export type Props = {|
  confirmText?: string,
  content?: React.Node,
  description: string,
  icon?: IconType,
  onCancel: () => void,
  onConfirm: () => void,
  prompt: string,
|}

class _ConfirmModal extends React.Component<Props> {
  render() {
    const confirmText = this.props.confirmText || 'Confirm'
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
                type={this.props.icon}
                color={Styles.globalColors.black_50}
                fontSize={Styles.isMobile ? 20 : 48}
                boxStyle={styles.icon}
              />
            )}
            <Text style={styles.text} type="Header">
              {this.props.prompt}
            </Text>
            <Text center={true} style={styles.text} type="BodySmall">
              {this.props.description}
            </Text>
            {this.props.content}
          </Box2>
        </Box2>
        <Box2 direction="horizontal" style={styles.buttonBox}>
          <ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
            <Button fullWidth={true} type="Secondary" label="Cancel" onClick={this.props.onCancel} />
            <Button fullWidth={true} type="Danger" label={confirmText} onClick={this.props.onConfirm} />
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
