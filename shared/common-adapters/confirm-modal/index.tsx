import * as React from 'react'
import WaitingButton from '../waiting-button'
import {Box2} from '../box'
import ButtonBar from '../button-bar'
import {Banner, BannerParagraph} from '../banner'
import Icon from '../icon'
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
  iconColor?: Styles.Color
  onCancel?: () => void
  onConfirm?: () => void
  prompt: React.ReactNode
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
        banners={
          this.props.error
            ? [
                <Banner key="error" color="red">
                  <BannerParagraph bannerColor="red" content={this.props.error} />
                </Banner>,
              ]
            : []
        }
        footer={{
          content: (
            <ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
              {!Styles.isMobile && (
                <WaitingButton
                  key="cancel"
                  disabled={!this.props.onCancel}
                  type="Dim"
                  label="Cancel"
                  onClick={this.props.onCancel}
                  style={styles.button}
                  waitingKey={this.props.waitingKey || null}
                />
              )}
              <WaitingButton
                key="confirm"
                disabled={!this.props.onConfirm}
                type="Danger"
                label={this.props.confirmText || 'Confirm'}
                onClick={this.props.onConfirm}
                style={styles.button}
                waitingKey={this.props.waitingKey || null}
              />
            </ButtonBar>
          ),
          hideBorder: true,
        }}
        onClose={this.props.onCancel || undefined}
        mode="Wide"
      >
        <Box2
          alignItems="center"
          direction="vertical"
          centerChildren={true}
          fullWidth={true}
          style={styles.container}
          noShrink={true}
        >
          {this.props.icon && (
            <Icon
              boxStyle={styles.icon}
              color={this.props.iconColor ? this.props.iconColor : Styles.globalColors.black_50}
              fontSize={Styles.isMobile ? 64 : 48}
              style={styles.icon}
              type={this.props.icon}
            />
          )}
          {this.props.header && (
            <Box2 alignItems="center" direction="vertical" style={styles.icon} noShrink={true}>
              {this.props.header}
            </Box2>
          )}
          {typeof this.props.prompt === 'string' ? (
            <Text center={true} style={styles.text} type="HeaderBig" lineClamp={2}>
              {this.props.prompt}
            </Text>
          ) : (
            this.props.prompt
          )}
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
