import * as React from 'react'
import * as Kb from '@/common-adapters'

type AliasInputProps = {
  error?: string
  disabled?: boolean
  alias: string
  onChangeAlias: (alias: string) => void
  onRemove?: () => void
  onEnterKeyDown?: (event?: React.BaseSyntheticEvent) => void
  small: boolean
}

export type AliasRef = {focus: () => void}
export function AliasInput(props: AliasInputProps & {ref?: React.Ref<AliasRef>}) {
  const styles = useStyles()
  const {ref, error, disabled, small, onChangeAlias, onEnterKeyDown, onRemove} = props
  const inputRef = React.useRef<Kb.Input3Ref>(null)

  React.useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
    },
  }))

  return (
    <Kb.Box2 direction="vertical" overflow="hidden" style={styles.aliasInputContainer} gap="xxtiny">
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" alignItems="center">
        <Kb.Input3
          ref={inputRef}
          error={!!error}
          disabled={disabled}
          textType={isMobile ? 'BodySemibold' : 'Body'}
          containerStyle={Kb.Styles.collapseStyles([styles.aliasInput, !small && styles.aliasInputLarge])}
          onChangeText={onChangeAlias}
          onEnterKeyDown={onEnterKeyDown}
        />
        {onRemove && (
          <Kb.ClickableBox direction="horizontal" centerChildren={true} onClick={onRemove} style={styles.removeBox}>
            <Kb.Icon type="iconfont-remove" />
          </Kb.ClickableBox>
        )}
      </Kb.Box2>
      {!!error && (
        <Kb.Text type="BodySmallError" lineClamp={1}>
          {error}
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

type ModalProps = {
  bannerImage: Kb.IconType
  bannerError?: string
  children: React.ReactNode
  footerButtonLabel?: string
  footerButtonOnClick?: () => void
  footerButtonWaiting?: boolean
  // false for a body that holds its own list
  scroll?: boolean
}

// the emoji modals' layout: an illustration over a full-bleed body, and an optional footer button
export const Modal = (props: ModalProps) => {
  const {bannerImage, bannerError, children, footerButtonLabel, footerButtonOnClick} = props
  const {footerButtonWaiting, scroll} = props
  const styles = useStyles()
  return (
    <Kb.ModalScreen
      scroll={scroll}
      padding="none"
      banner={
        <>
          {!!bannerError && <Kb.Banner color="red">{bannerError}</Kb.Banner>}
          <Kb.Box2 direction="horizontal" fullWidth={true} noShrink={true} style={styles.bannerContainer}>
            <Kb.ImageIcon type={bannerImage} style={styles.bannerImage} />
          </Kb.Box2>
        </>
      }
      footer={
        footerButtonLabel ? (
          <Kb.Button
            mode="Primary"
            label={footerButtonLabel}
            fullWidth={true}
            onClick={footerButtonOnClick}
            disabled={!footerButtonOnClick}
            waiting={footerButtonWaiting}
          />
        ) : undefined
      }
    >
      {children}
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  aliasInput: Kb.Styles.platformStyles({
    common: {
      flexBasis: 0,
      flexGrow: 1,
      height: '100%',
    },
    isElectron: {
      height: Kb.Styles.globalMargins.mediumLarge,
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.xsmall),
    },
    isMobile: {
      height: Kb.Styles.globalMargins.large,
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
    },
  }),
  aliasInputContainer: {...Kb.Styles.globalStyles.flexGrow, flexShrink: 1},
  aliasInputLarge: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
    },
    isElectron: {
      height: Kb.Styles.globalMargins.large,
    },
    isMobile: {
      height: Kb.Styles.globalMargins.large + 3 * Kb.Styles.globalMargins.xxtiny,
    },
  }),
  bannerContainer: {
    height: Kb.Styles.globalMargins.xlarge + Kb.Styles.globalMargins.mediumLarge,
  },
  bannerImage: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.size('100%'),
    },
    isElectron: {
      objectFit: 'cover',
    },
    isMobile: {
      resizeMode: 'cover',
    },
  }),
  removeBox: {
    padding: Kb.Styles.globalMargins.xtiny,
  },
}))
