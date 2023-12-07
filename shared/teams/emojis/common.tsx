import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'

type AliasInputProps = {
  error?: string
  disabled?: boolean
  alias: string
  onChangeAlias: (alias: string) => void
  onRemove?: () => void
  onEnterKeyDown?: (event?: React.BaseSyntheticEvent) => void
  small: boolean
}

export class AliasInput extends React.PureComponent<AliasInputProps> {
  focus() {
    this.inputRef.current?.focus()
    this.onFocus()
  }
  private inputRef = React.createRef<Kb.PlainInput>()
  private mounted = true
  componentWillUnmount() {
    this.mounted = false
  }
  private onFocus = () => {
    setTimeout(
      () =>
        this.mounted &&
        this.inputRef.current?.transformText(
          () => ({
            selection: {
              end: this.props.alias.length + 1,
              start: this.props.alias.length + 1,
            },
            text: `:${this.props.alias}:`,
          }),
          true
        )
    )
  }
  render() {
    return (
      <Kb.Box2 direction="vertical" style={styles.aliasInputContainer} gap="xxtiny">
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" alignItems="center">
          <Kb.NewInput
            ref={this.inputRef}
            error={!!this.props.error}
            disabled={this.props.disabled}
            textType={Kb.Styles.isMobile ? 'BodySemibold' : 'Body'}
            containerStyle={Kb.Styles.collapseStyles([
              styles.aliasInput,
              !this.props.small && styles.aliasInputLarge,
            ])}
            onChangeText={newText => {
              // Remove both colon and special characters.
              const cleaned = newText.replace(/[^a-zA-Z0-9-_+]/g, '')
              if (newText !== `:${cleaned}:`) {
                // if the input currently contains invalid characters, overwrite with clean text and reset selection
                this.inputRef.current?.transformText(
                  () => ({
                    selection: {end: cleaned.length + 1, start: cleaned.length + 1},
                    text: `:${cleaned}:`,
                  }),
                  true
                )
              }
              this.props.onChangeAlias(cleaned)
            }}
            onEnterKeyDown={this.props.onEnterKeyDown}
            onFocus={this.onFocus}
          />
          {this.props.onRemove && (
            <Kb.ClickableBox onClick={this.props.onRemove} style={styles.removeBox}>
              <Kb.Icon type="iconfont-remove" />
            </Kb.ClickableBox>
          )}
        </Kb.Box2>
        {!!this.props.error && (
          <Kb.Text type="BodySmallError" lineClamp={1}>
            {this.props.error}
          </Kb.Text>
        )}
      </Kb.Box2>
    )
  }
}

type ModalProps = {
  backButtonOnClick?: () => void
  bannerImage: Kb.IconType
  bannerError?: string
  children: React.ReactNode
  desktopHeight?: number
  footerButtonLabel?: string
  footerButtonOnClick?: () => void
  footerButtonWaiting?: boolean
  title: string
}

export const Modal = (props: ModalProps) => {
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => clearModals()
  return (
    <Kb.PopupWrapper onCancel={onCancel} title={props.title}>
      <Kb.Box2
        direction="vertical"
        fullHeight={Kb.Styles.isMobile}
        fullWidth={Kb.Styles.isMobile}
        style={Kb.Styles.collapseStyles([
          styles.container,
          !Kb.Styles.isMobile && props.desktopHeight !== undefined && {height: props.desktopHeight},
        ])}
      >
        {!Kb.Styles.isMobile && (
          <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.headerContainer}>
            {props.backButtonOnClick && (
              <Kb.Icon
                type="iconfont-arrow-left"
                boxStyle={styles.backButton}
                onClick={props.backButtonOnClick}
              />
            )}
            <Kb.Text type="Header">{props.title}</Kb.Text>
          </Kb.Box2>
        )}
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.bannerContainer}>
          <Kb.Icon type={props.bannerImage} noContainer={true} style={styles.bannerImage} />
          {!!props.bannerError && (
            <Kb.Banner color="red" style={styles.bannerError}>
              {props.bannerError}
            </Kb.Banner>
          )}
        </Kb.Box2>
        {props.children}
        {props.footerButtonLabel && (
          <Kb.Box2
            direction="vertical"
            centerChildren={true}
            style={styles.footerContainer}
            gap="small"
            fullWidth={true}
          >
            <Kb.Button
              mode="Primary"
              label={props.footerButtonLabel}
              fullWidth={true}
              onClick={props.footerButtonOnClick}
              disabled={!props.footerButtonOnClick}
              waiting={props.footerButtonWaiting}
            />
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.PopupWrapper>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  aliasInput: Kb.Styles.platformStyles({
    common: {
      flexBasis: 0,
      flexGrow: 1,
      height: '100%',
    },
    isElectron: {
      height: Kb.Styles.globalMargins.mediumLarge,
      paddingLeft: Kb.Styles.globalMargins.xsmall,
      paddingRight: Kb.Styles.globalMargins.xsmall,
    },
    isMobile: {
      height: Kb.Styles.globalMargins.large,
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    },
  }),
  aliasInputContainer: {...Kb.Styles.globalStyles.flexGrow, flexShrink: 1, overflow: 'hidden'},
  aliasInputLarge: Kb.Styles.platformStyles({
    common: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    },
    isElectron: {
      height: Kb.Styles.globalMargins.large,
    },
    isMobile: {
      height: Kb.Styles.globalMargins.large + 3 * Kb.Styles.globalMargins.xxtiny,
    },
  }),
  backButton: {
    left: Kb.Styles.globalMargins.xsmall,
    position: 'absolute',
  },
  bannerContainer: {
    height: Kb.Styles.globalMargins.xlarge + Kb.Styles.globalMargins.mediumLarge,
    position: 'relative',
  },
  bannerError: Kb.Styles.platformStyles({
    common: {
      position: 'absolute',
    },
  }),
  bannerImage: Kb.Styles.platformStyles({
    common: {
      height: '100%',
      width: '100%',
    },
    isElectron: {
      objectFit: 'cover',
    },
    isMobile: {
      resizeMode: 'cover',
    },
  }),
  container: Kb.Styles.platformStyles({
    common: {
      position: 'relative',
    },
    isElectron: {
      width: 400,
    },
  }),
  footerContainer: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
    },
    isMobile: {
      padding: Kb.Styles.globalMargins.small,
    },
  }),
  headerContainer: Kb.Styles.platformStyles({
    isElectron: {
      height: Kb.Styles.globalMargins.large + Kb.Styles.globalMargins.tiny,
    },
  }),
  removeBox: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Kb.Styles.globalMargins.xtiny,
  },
}))
