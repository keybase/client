import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {type Props as ButtonProps} from '../common-adapters/button'
import openURL from '../util/open-url'
import * as Styles from '../styles'

type InfoIconProps = {
  invisible?: boolean
  style?: Styles.StylesCrossPlatform
}

export const InfoIcon = (props: InfoIconProps) => {
  const loggedIn = Container.useSelector(state => state.config.loggedIn)
  const dispatch = Container.useDispatch()
  const onDocumentation = () => openURL('https://book.keybase.io/docs')
  const onFeedback = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [loggedIn ? 'signupSendFeedbackLoggedIn' : 'signupSendFeedbackLoggedOut'],
      })
    )
  }

  const {showingPopup, toggleShowingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      items={[
        {onClick: onFeedback, title: 'Send feedback'},
        {onClick: onDocumentation, title: 'Documentation'},
      ]}
      attachTo={attachTo}
      visible={showingPopup}
      onHidden={toggleShowingPopup}
      closeOnSelect={true}
    />
  ))

  return (
    <>
      <Kb.Icon
        type="iconfont-question-mark"
        onClick={props.invisible ? undefined : toggleShowingPopup}
        ref={popupAnchor as any}
        style={Styles.collapseStyles([
          Styles.desktopStyles.windowDraggingClickable,
          props.invisible && styles.opacityNone,
          props.style,
        ] as any)}
      />
      {popup}
    </>
  )
}

type HeaderProps = {
  onBack?: (() => void) | null
  title?: string
  titleComponent?: React.ReactNode
  showInfoIcon: boolean
  showInfoIconRow: boolean
  style: Styles.StylesCrossPlatform
  negative: boolean
  rightActionComponent?: React.ReactNode
  rightActionLabel?: string
  onRightAction?: (() => void) | null
}

// Only used on desktop
const Header = (props: HeaderProps) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([styles.headerContainer, props.style])}
  >
    {(props.showInfoIcon || props.showInfoIconRow) && (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.infoIconContainer}>
        <InfoIcon invisible={props.negative || (props.showInfoIconRow && !props.showInfoIcon)} />
      </Kb.Box2>
    )}
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.titleContainer} fullWidth={true}>
      {props.onBack && (
        <Kb.ClickableBox onClick={props.onBack} style={styles.backButton}>
          <Kb.Box2 direction="horizontal" alignItems="center" gap="xtiny">
            <Kb.Icon
              type="iconfont-arrow-left"
              color={props.negative ? Styles.globalColors.white : Styles.globalColors.black_50}
              sizeType="Small"
              style={styles.fixIconAlignment}
            />
            <Kb.Text
              type="Body"
              style={props.negative ? undefined : styles.backText}
              negative={props.negative}
            >
              Back
            </Kb.Text>
          </Kb.Box2>
        </Kb.ClickableBox>
      )}
      {props.titleComponent || <Kb.Text type="Header">{props.title}</Kb.Text>}
      {props.onRightAction && !!props.rightActionLabel && (
        <Kb.Button
          type="Default"
          mode="Secondary"
          small={true}
          label={props.rightActionLabel}
          onClick={props.onRightAction}
          style={styles.rightActionButton}
        />
      )}
      {props.rightActionComponent && (
        <Kb.Box2 direction="horizontal" style={styles.rightAction}>
          {props.rightActionComponent}
        </Kb.Box2>
      )}
    </Kb.Box2>
  </Kb.Box2>
)

type ButtonMeta = {
  disabled?: boolean
  label: string
  onClick: () => void
  type?: ButtonProps['type']
  waiting?: boolean
  waitingKey?: string | null // makes this a WaitingButton
}

type SignupScreenProps = {
  banners?: React.ReactNode
  buttons?: Array<ButtonMeta>
  children: React.ReactNode
  negativeHeader?: boolean
  noBackground?: boolean
  onBack?: () => void
  skipMobileHeader?: boolean
  headerStyle?: Styles.StylesCrossPlatform
  containerStyle?: Styles.StylesCrossPlatform
  contentContainerStyle?: Styles.StylesCrossPlatform
  title?: string
  titleComponent?: React.ReactNode
  header?: React.ReactNode
  rightActionComponent?: React.ReactNode
  rightActionLabel?: string
  onRightAction?: (() => void) | null
  leftAction?: 'back' | 'cancel'
  leftActionText?: string
  showHeaderInfoicon?: boolean
  showHeaderInfoiconRow?: boolean
}

// Screens with header + body bg color (i.e. all but join-or-login)
export const SignupScreen = (props: SignupScreenProps) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    fullHeight={true}
    alignItems="center"
    style={styles.whiteBackground}
  >
    {!Styles.isMobile && (
      <Header
        onBack={props.onBack}
        title={props.title}
        titleComponent={props.titleComponent}
        showInfoIcon={!!props.showHeaderInfoicon}
        showInfoIconRow={!!props.showHeaderInfoiconRow}
        style={Styles.collapseStyles([props.noBackground && styles.whiteHeaderContainer, props.headerStyle])}
        negative={!!props.negativeHeader}
        rightActionComponent={props.rightActionComponent}
        rightActionLabel={props.rightActionLabel}
        onRightAction={props.onRightAction}
      />
    )}
    {Styles.isMobile && !props.skipMobileHeader && (
      <Kb.ModalHeader
        leftButton={
          props.leftAction && props.onBack ? (
            <Kb.Text type="BodyBigLink" onClick={props.onBack}>
              {props.leftActionText || props.leftAction}
            </Kb.Text>
          ) : null
        }
        rightButton={
          props.onRightAction ? (
            <Kb.Text type="BodyBigLink" onClick={props.onRightAction}>
              {props.rightActionLabel || props.rightActionComponent}
            </Kb.Text>
          ) : null
        }
        style={props.headerStyle}
        title={props.title ? <Kb.Text type="BodyBig">{props.title}</Kb.Text> : props.titleComponent}
      />
    )}
    {Styles.isMobile && props.header}
    <Kb.Box2
      alignItems="center"
      direction="vertical"
      style={Styles.collapseStyles([
        styles.background,
        props.noBackground ? styles.whiteBackground : styles.blueBackground,
        props.containerStyle,
      ])}
      fullWidth={true}
    >
      <Kb.Box2
        alignItems="center"
        direction="vertical"
        style={Styles.collapseStyles([styles.body, props.contentContainerStyle])}
        fullWidth={true}
      >
        {props.children}
      </Kb.Box2>
      {/* Banners after children so they go on top */}
      {!!props.banners && <Kb.Box2 direction="vertical" style={styles.banners} children={props.banners} />}
      {!!props.buttons && (
        <Kb.ButtonBar
          direction="column"
          fullWidth={Styles.isMobile && !Styles.isTablet}
          style={styles.buttonBar}
        >
          {props.buttons.map(b =>
            b.waitingKey !== undefined ? (
              <Kb.WaitingButton
                key={b.label}
                style={styles.button}
                {...b}
                // TS doesn't narrow the type inside ButtonMeta, so still thinks
                // waitingKey can be undefined unless we pull it out
                waitingKey={b.waitingKey}
                fullWidth={true}
              />
            ) : (
              <Kb.Button key={b.label} style={styles.button} {...b} fullWidth={true} />
            )
          )}
        </Kb.ButtonBar>
      )}
    </Kb.Box2>
  </Kb.Box2>
)
SignupScreen.defaultProps = {
  leftAction: 'cancel',
  leftActionText: 'Back',
}

export const errorBanner = (error: string) =>
  error.trim() ? (
    <Kb.Banner key="generalError" color="red">
      <Kb.BannerParagraph bannerColor="red" content={error} />
    </Kb.Banner>
  ) : null

const styles = Styles.styleSheetCreate(
  () =>
    ({
      backButton: {
        bottom: Styles.globalMargins.small,
        left: Styles.globalMargins.small,
        position: 'absolute',
      },
      backText: {
        color: Styles.globalColors.black_50,
      },
      background: {
        flex: 1,
        position: 'relative',
      },
      banners: {
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      blueBackground: {
        backgroundColor: Styles.globalColors.blueGrey,
      },
      body: {
        ...Styles.padding(
          Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.xlarge,
          Styles.globalMargins.small
        ),
        flex: 1,
      },
      button: Styles.platformStyles({
        isElectron: {
          height: 32,
          width: 368,
        },
        isMobile: {
          height: 40,
          width: '100%',
        },
        isTablet: {
          maxWidth: 368,
        },
      }),
      buttonBar: Styles.platformStyles({
        isElectron: {
          paddingBottom: Styles.globalMargins.xlarge - Styles.globalMargins.tiny, // tiny added inside buttonbar
        },
        isMobile: {
          ...Styles.padding(0, Styles.globalMargins.small, Styles.globalMargins.tiny),
        },
      }),
      fixIconAlignment: {
        position: 'relative',
        top: 2,
      },
      headerContainer: {
        backgroundColor: Styles.globalColors.white,
      },
      infoIconContainer: {
        justifyContent: 'flex-end',
        ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small, 0),
      },
      opacityNone: {
        opacity: 0,
      },
      rightAction: Styles.platformStyles({
        common: {
          alignItems: 'center',
          alignSelf: 'flex-end',
          bottom: 0,
          justifyContent: 'center',
          paddingRight: Styles.globalMargins.small,
          position: 'absolute',
          right: 0,
          top: 0,
        },
        isElectron: Styles.desktopStyles.windowDraggingClickable,
      }),
      rightActionButton: Styles.platformStyles({
        common: {
          position: 'absolute',
          right: Styles.globalMargins.small,
          top: 10,
        },
        isElectron: Styles.desktopStyles.windowDraggingClickable,
      }),
      titleContainer: {
        ...Styles.padding(Styles.globalMargins.xsmall, 0, Styles.globalMargins.small),
        position: 'relative',
      },
      whiteBackground: {
        backgroundColor: Styles.globalColors.white,
      },
      whiteHeaderContainer: {
        borderBottomColor: Styles.globalColors.black_10,
        borderBottomWidth: 1,
        borderStyle: 'solid',
      },
    } as const)
)
