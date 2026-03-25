import type * as React from 'react'
import * as Styles from '@/styles'
import ButtonBar from './button-bar'
import IconAuto from '@/common-adapters/icon-auto'
import Text from '@/common-adapters/text'
import WaitingButton from './waiting-button'
import type {IconType} from '@/common-adapters/icon.constants-gen'
import {Banner, BannerParagraph} from './banner'
import {Box2} from '@/common-adapters/box'

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
  waiting?: boolean
}

const ConfirmModal = (props: Props) => (
  <>
    {props.error ? (
      <Banner key="error" color="red">
        <BannerParagraph bannerColor="red" content={props.error} />
      </Banner>
    ) : null}
    <Box2
      alignItems="center"
      direction="vertical"
      centerChildren={true}
      fullWidth={true}
      style={styles.container}
      noShrink={true}
    >
      {props.icon && (
        <Box2 direction="vertical" style={styles.icon}>
          <IconAuto
            color={props.iconColor ? props.iconColor : Styles.globalColors.black_50}
            fontSize={Styles.isMobile ? 64 : 48}
            style={styles.icon}
            type={props.icon}
          />
        </Box2>
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
    <Box2 direction="vertical" centerChildren={true} fullWidth={true} style={Styles.isMobile ? styles.modalFooterNoBorder : styles.modalFooter}>
      <ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
        {!Styles.isMobile && (
          <WaitingButton
            key="cancel"
            disabled={!props.onCancel || props.waiting}
            type="Dim"
            label="Cancel"
            onClick={props.onCancel}
            style={styles.button}
            waitingKey={props.waitingKey}
          />
        )}
        <WaitingButton
          key="confirm"
          disabled={props.onConfirmDeactivated || !props.onConfirm}
          type="Danger"
          label={props.confirmText || 'Confirm'}
          lockOnClick={!!props.waitingKey}
          onClick={props.onConfirm}
          style={styles.button}
          waitingKey={props.waitingKey}
          waiting={props.waiting}
        />
      </ButtonBar>
    </Box2>
  </>
)

const styles = Styles.styleSheetCreate(() => ({
  button: {flex: 1},
  buttonBar: {minHeight: undefined},
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
  modalFooter: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Styles.borderRadius,
      borderBottomRightRadius: Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
  modalFooterNoBorder: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Styles.borderRadius,
      borderBottomRightRadius: Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
  text: {
    color: Styles.globalColors.black,
    margin: Styles.globalMargins.small,
  },
}))

export default ConfirmModal
