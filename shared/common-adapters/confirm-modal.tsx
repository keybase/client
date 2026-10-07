import type * as React from 'react'
import * as Styles from '@/styles'
import ConfirmButtons from './confirm-buttons'
import IconAuto from '@/common-adapters/icon-auto'
import Text from '@/common-adapters/text'
import type {IconType} from '@/common-adapters/icon.constants-gen'
import {Banner, BannerParagraph} from './banner'
import {Box2} from '@/common-adapters/box'
import ModalScreen from './modal-screen'

// generally one of icon or header will be given. The route names the action in its title; the
// prompt names what it acts on.
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
  prompt?: string
  waitingKey?: string | string[]
  waiting?: boolean
}

const noop = () => {}

const ConfirmModal = (props: Props) => {
  const {confirmText, content, description, error, header, icon, iconColor, onCancel, onConfirm} = props
  const {onConfirmDeactivated, prompt, waitingKey, waiting} = props
  const styles = useStyles()
  const theme = Styles.useTheme()
  return (
    <ModalScreen
      centered={true}
      banner={
        error ? (
          <Banner color="red">
            <BannerParagraph bannerColor="red" content={error} />
          </Banner>
        ) : undefined
      }
      footer={
        <ConfirmButtons
          split={true}
          onCancel={onCancel ?? noop}
          onConfirm={onConfirm ?? noop}
          confirmDisabled={onConfirmDeactivated || !onConfirm}
          confirmLabel={confirmText || 'Confirm'}
          confirmType="Danger"
          waitingKey={waitingKey}
          waiting={waiting}
        />
      }
    >
      {icon && (
        <Box2 direction="vertical" style={styles.art}>
          <IconAuto color={iconColor ?? theme.black_50} fontSize={isMobile ? 64 : 48} type={icon} />
        </Box2>
      )}
      {header && (
        <Box2 alignItems="center" direction="vertical" style={styles.art} noShrink={true}>
          {header}
        </Box2>
      )}
      {!!prompt && (
        <Text center={true} style={styles.text} type="BodyBig" lineClamp={2}>
          {prompt}
        </Text>
      )}
      {!!description && (
        <Text center={true} style={styles.text} type="Body">
          {description}
        </Text>
      )}
      {content}
    </ModalScreen>
  )
}

const useStyles = Styles.createStyleHook(theme => ({
  art: {...Styles.marginV(Styles.globalMargins.small)},
  text: {
    color: theme.black,
    margin: Styles.globalMargins.tiny,
  },
}))

export default ConfirmModal
