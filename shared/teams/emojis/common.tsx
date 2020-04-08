import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type AliasInputProps = {
  error?: string
  alias: string
  onChangeAlias: (alias: string) => void
  onEnterKeyDown?: (event?: React.BaseSyntheticEvent) => void
  small: boolean
}

export class AliasInput extends React.PureComponent<AliasInputProps, {}> {
  focus() {
    this.inputRef.current?.focus()
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
        this.inputRef.current?.setSelection({
          end: this.props.alias.length + 1,
          start: this.props.alias.length + 1,
        })
    )
  }
  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} gap="xxtiny">
        <Kb.NewInput
          ref={this.inputRef}
          error={!!this.props.error}
          textType={Styles.isMobile ? 'BodySemibold' : 'Body'}
          value={`:${this.props.alias}:`}
          containerStyle={Styles.collapseStyles([
            styles.aliasInput,
            !this.props.small && styles.aliasInputLarge,
          ])}
          onChangeText={newText =>
            // Remove both colon and special characters.
            this.props.onChangeAlias(newText.replace(/[^a-zA-Z0-9-_+]/g, ''))
          }
          onEnterKeyDown={this.props.onEnterKeyDown}
          onFocus={this.onFocus}
        />
        {!!this.props.error && <Kb.Text type="BodySmallError">{this.props.error}</Kb.Text>}
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
  const dispatch = Container.useDispatch()
  const onCancel = () => dispatch(RouteTreeGen.createClearModals())
  return (
    <Kb.PopupWrapper onCancel={onCancel} title={props.title}>
      <Kb.Box2
        direction="vertical"
        fullHeight={Styles.isMobile}
        fullWidth={Styles.isMobile}
        style={Styles.collapseStyles([
          styles.container,
          !Styles.isMobile && props.desktopHeight !== undefined && {height: props.desktopHeight},
        ])}
      >
        {!Styles.isMobile && (
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

const styles = Styles.styleSheetCreate(() => ({
  aliasInput: Styles.platformStyles({
    common: {
      flexGrow: 1,
      height: '100%',
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  aliasInputLarge: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isElectron: {
      height: Styles.globalMargins.large,
    },
    isMobile: {
      height: Styles.globalMargins.large + 3 * Styles.globalMargins.xxtiny,
    },
  }),
  backButton: {
    left: Styles.globalMargins.xsmall,
    position: 'absolute',
  },
  bannerContainer: {
    height: Styles.globalMargins.xlarge + Styles.globalMargins.mediumLarge,
    position: 'relative',
  },
  bannerError: Styles.platformStyles({
    common: {
      position: 'absolute',
    },
  }),
  bannerImage: Styles.platformStyles({
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
  container: Styles.platformStyles({
    common: {
      position: 'relative',
    },
    isElectron: {
      width: 400,
    },
  }),
  footerContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
    },
    isMobile: {
      padding: Styles.globalMargins.small,
    },
  }),
  headerContainer: Styles.platformStyles({
    isElectron: {
      height: Styles.globalMargins.large + Styles.globalMargins.tiny,
    },
  }),
}))
