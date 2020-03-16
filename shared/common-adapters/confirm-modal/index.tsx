import * as React from 'react'
import WaitingButton from '../waiting-button'
import {Box2} from '../box'
import ButtonBar from '../button-bar'
import {Banner, BannerParagraph} from '../banner'
import Icon from '../icon'
import Text from '../text'
import Modal from '../modal'
import * as Styles from '../../styles'
import {IconType} from '../icon.constants-gen'

// generally one of icon or header will be given
export type Props = {
  confirmText?: string
  content?: React.ReactNode
  description?: string
  error?: string
  header?: React.ReactNode
  icon?: IconType
  iconColor?: Styles.Color
  onCancel?: () => void
  onConfirm?: () => void
  onConfirmDeactivated?: boolean
  prompt: React.ReactNode
  waitingKey?: string | string[]
}

const ConfirmModal = (props: Props) => (
  <Modal
    header={
      Styles.isMobile && props.onCancel
        ? {
            leftButton: (
              <Text type="BodyBigLink" onClick={props.onCancel}>
                Cancel
              </Text>
            ),
          }
        : undefined
    }
    banners={
      props.error
        ? [
            <Banner key="error" color="red">
              <BannerParagraph bannerColor="red" content={props.error} />
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
              disabled={!props.onCancel}
              type="Dim"
              label="Cancel"
              onClick={props.onCancel}
              style={styles.button}
              waitingKey={props.waitingKey || null}
            />
          )}
          <WaitingButton
            key="confirm"
            disabled={props.onConfirmDeactivated || !props.onConfirm}
            type="Danger"
            label={props.confirmText || 'Confirm'}
            onClick={props.onConfirm}
            style={styles.button}
            waitingKey={props.waitingKey || null}
          />
        </ButtonBar>
      ),
      hideBorder: Styles.isMobile,
    }}
    onClose={props.onCancel || undefined}
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
      {props.icon && (
        <Icon
          boxStyle={styles.icon}
          color={props.iconColor ? props.iconColor : Styles.globalColors.black_50}
          fontSize={Styles.isMobile ? 64 : 48}
          style={styles.icon}
          type={props.icon}
        />
      )}
      {props.header && (
        <Box2 alignItems="center" direction="vertical" style={styles.icon} noShrink={true}>
          {props.header}
        </Box2>
      )}
      {typeof props.prompt === 'string' ? (
        <Text center={true} style={styles.text} type="HeaderBig" lineClamp={2}>
          {props.prompt}
        </Text>
      ) : (
        props.prompt
      )}
      {!!props.description && (
        <Text center={true} style={styles.text} type="Body">
          {props.description}
        </Text>
      )}
      {props.content}
    </Box2>
  </Modal>
)

const styles = Styles.styleSheetCreate(() => ({
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
}))

export default ConfirmModal
