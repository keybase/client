import * as C from '@/constants'
import type * as React from 'react'
import * as Kb from '@/common-adapters'
import {type ButtonProps} from '@/common-adapters/button'
import {openURL} from '@/util/misc'
import {useConfigState} from '@/stores/config'
import ProvisionWaitingOverlay from '@/provision/waiting-overlay'

export const desktopInputWidth = Kb.Styles.platformStyles({
  isElectron: {width: 368},
  isTablet: {width: 368},
})

type InfoIconProps = {
  invisible?: boolean
  style?: Kb.Styles.StylesCrossPlatform
}

export const InfoIcon = (props: InfoIconProps) => {
  const styles = useStyles()
  const loggedIn = useConfigState(s => s.loggedIn)
  const navigateAppend = C.Router2.navigateAppend
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    const onDocumentation = () => { void openURL('https://book.keybase.io/docs') }
    const onFeedback = () => {
      navigateAppend({
        name: loggedIn ? 'signupSendFeedbackLoggedIn' : 'signupSendFeedbackLoggedOut',
        params: {},
      })
    }

    return (
      <Kb.FloatingMenu
        items={[
          {onClick: onFeedback, title: 'Send feedback'},
          {onClick: onDocumentation, title: 'Documentation'},
        ]}
        attachTo={attachTo}
        visible={true}
        onHidden={hidePopup}
        closeOnSelect={true}
      />
    )
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <>
      <Kb.Box2 alignSelf="center" direction="vertical" ref={popupAnchor} style={Kb.Styles.collapseStyles([props.invisible && styles.opacityNone, props.style])}>
        <Kb.Icon
          type="iconfont-question-mark"
          onClick={props.invisible ? undefined : showPopup}
          style={Kb.Styles.platformStyles({isElectron: {...Kb.Styles.desktopStyles.windowDraggingClickable}})}
        />
      </Kb.Box2>
      {popup}
    </>
  )
}

type ButtonMeta = {
  disabled?: boolean
  label: string
  onClick: () => void
  type?: ButtonProps['type']
  waiting?: boolean
  waitingKey?: string // makes this a WaitingButton
}

type SignupScreenProps = {
  banners?: React.ReactNode
  buttons?: Array<ButtonMeta>
  children: React.ReactNode
  noBackground?: boolean
  containerStyle?: Kb.Styles.StylesCrossPlatform
  contentContainerStyle?: Kb.Styles.StylesCrossPlatform
  footer?: React.ReactNode
  // in a modal: false when the body is a list that scrolls itself (needs a medium box)
  modalScroll?: boolean
  waitingOverlay?: boolean
}

// Screens with a body bg color (i.e. all but join-or-login). The route's header owns the title, back
// and actions. In a modal (signup and provision screens over the logged-in app) the body sits in a
// ModalScreen.
export const SignupScreen = (props: SignupScreenProps) =>
  Kb.useModalBox() ? <SignupModalScreen {...props} /> : <SignupPageScreen {...props} />

const SignupButtons = ({buttons}: {buttons: ReadonlyArray<ButtonMeta>}) => (
  <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
    {buttons.map(b =>
      b.waitingKey !== undefined ? (
        <Kb.WaitingButton key={b.label} {...b} waitingKey={b.waitingKey} fullWidth={true} />
      ) : (
        <Kb.Button key={b.label} {...b} fullWidth={true} />
      )
    )}
  </Kb.Box2>
)

const SignupModalScreen = (props: SignupScreenProps) => {
  const {banners, buttons, children, containerStyle, contentContainerStyle, footer, modalScroll, waitingOverlay} =
    props
  return (
    <>
      <Kb.ModalScreen
        banner={banners}
        footer={buttons ? <SignupButtons buttons={buttons} /> : undefined}
        // a colored body (verify phone) already sets the footer apart
        footerDivider={!containerStyle}
        padding={modalScroll === false ? 'none' : 'standard'}
        scroll={modalScroll}
        style={containerStyle}
      >
        <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} flex={1} style={contentContainerStyle}>
          {children}
        </Kb.Box2>
        {footer}
      </Kb.ModalScreen>
      {waitingOverlay && <ProvisionWaitingOverlay />}
    </>
  )
}

const SignupPageScreen = (props: SignupScreenProps) => {
  const {banners, buttons, children, containerStyle, contentContainerStyle, footer, noBackground, waitingOverlay} =
    props
  const styles = useStyles()
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      alignItems="center"
      relative={true}
      style={styles.whiteBackground}
    >
      <Kb.Box2
        alignItems="center"
        direction="vertical"
        relative={true}
        flex={1}
        style={Kb.Styles.collapseStyles([
          noBackground ? styles.whiteBackground : styles.blueBackground,
          containerStyle,
        ])}
        fullWidth={true}
      >
        <Kb.Box2
          alignItems="center"
          direction="vertical"
          style={Kb.Styles.collapseStyles([styles.body, contentContainerStyle])}
          fullWidth={true}
        >
          {children}
        </Kb.Box2>
        {!!footer && (
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.footer}>
            {footer}
          </Kb.Box2>
        )}
        {!!banners && <Kb.Box2 alignSelf="center" direction="vertical" style={styles.banners}>{banners}</Kb.Box2>}
        {!!buttons && (
          <Kb.ButtonBar
            direction="column"
            fullWidth={isMobile && !Kb.Styles.isTablet}
            style={styles.buttonBar}
          >
            {buttons.map(b =>
              b.waitingKey !== undefined ? (
                <Kb.WaitingButton
                  key={b.label}
                  style={styles.button}
                  {...b}
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
      {waitingOverlay && <ProvisionWaitingOverlay />}
    </Kb.Box2>
  )
}

export const errorBanner = (error: string) =>
  error.trim() ? (
    <Kb.Banner key="generalError" color="red">
      <Kb.BannerParagraph bannerColor="red" content={error} />
    </Kb.Banner>
  ) : null

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      banners: {
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      blueBackground: {
        backgroundColor: theme.blueGrey,
      },
      body: {
        ...Kb.Styles.padding(
          isMobile ? Kb.Styles.globalMargins.small : Kb.Styles.globalMargins.xlarge,
          Kb.Styles.globalMargins.small
        ),
        flex: 1,
      },
      button: Kb.Styles.platformStyles({
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
      buttonBar: Kb.Styles.platformStyles({
        isElectron: {
          paddingBottom: Kb.Styles.globalMargins.xlarge - Kb.Styles.globalMargins.tiny, // tiny added inside buttonbar
        },
        isMobile: {
          ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.tiny),
        },
      }),
      footer: Kb.Styles.platformStyles({
        isMobile: {
          ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.tiny),
        },
      }),
      opacityNone: {
        opacity: 0,
      },
      whiteBackground: {
        backgroundColor: theme.white,
      },
    }) as const
)
