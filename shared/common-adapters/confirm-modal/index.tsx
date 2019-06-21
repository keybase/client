import * as React from 'react'
import WaitingButton from '../waiting-button'
import {Box, Box2} from '../box'
import HeaderOrPopup from '../header-or-popup'
import ButtonBar from '../button-bar'
import Banner from '../banner'
import Icon from '../icon'
import ScrollView from '../scroll-view'
import Text from '../text'
import Modal from '../modal'
import * as Styles from '../../styles'
import {IconType} from '../icon.constants'

// generally one of icon or header will be given
export type Props = {
  confirmText?: string
  content?: React.ReactNode
  description: string
  error?: string
  header?: React.ReactNode
  icon?: IconType
  onCancel: () => void | null
  onConfirm: () => void | null
  prompt: string
  waitingKey?: string
}

class ConfirmModal extends React.PureComponent<Props> {
  render() {
    return (
      <Modal
        header={
          Styles.isMobile
            ? {
                leftButton: (
                  <Text type="BodyBigLink" onClick={this.props.onCancel}>
                    Cancel
                  </Text>
                ),
              }
            : undefined
        }
        banners={this.props.error ? [<Banner key="error" color="red" text={this.props.error} />] : []}
        footer={{
          children: (
            <ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
              {!Styles.isMobile && (
                <WaitingButton
                  key="cancel"
                  disabled={!this.props.onCancel}
                  type="Dim"
                  label="Cancel"
                  onClick={this.props.onCancel}
                  style={styles.button}
                  waitingKey={this.props.waitingKey}
                />
              )}
              <WaitingButton
                key="confirm"
                disabled={!this.props.onConfirm}
                type="Danger"
                label={this.props.confirmText || 'Confirm'}
                onClick={this.props.onConfirm}
                style={styles.button}
                waitingKey={this.props.waitingKey}
              />
            </ButtonBar>
          ),
          hideBorder: true,
        }}
        onClose={this.props.onCancel}
        mode="Wide"
      >
        <Box2
          alignItems="center"
          direction="vertical"
          centerChildren={true}
          fullWidth={true}
          fullHeight={true}
          style={styles.container}
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
          {this.props.header && (
            <Box2 alignItems="center" direction="vertical" style={styles.icon}>
              {this.props.header}
            </Box2>
          )}
          <Text center={true} style={styles.text} type="HeaderBig">
            {this.props.prompt}
          </Text>
          <Text center={true} style={styles.text} type="Body">
            {this.props.description}
          </Text>
          {this.props.content}
        </Box2>
      </Modal>
    )
  }
}

const styles = Styles.styleSheetCreate({
  button: {
    flex: 1,
  },
  buttonBar: {
    minHeight: undefined,
  },
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xlarge),
      flex: 1,
    },
  }),
  icon: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
  },
  text: {
    color: Styles.globalColors.black,
    margin: Styles.globalMargins.small,
  },
})

export default ConfirmModal
