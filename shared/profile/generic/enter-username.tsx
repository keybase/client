import * as C from '@/constants'
import {useProfileState} from '@/stores/profile'
import openURL from '@/util/open-url'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SiteIcon} from './shared'
import type * as T from '@/constants/types'

const ConnectedEnterUsername = () => {
  const {platformGenericChecking, platformGenericParams, platformGenericURL, username} = useProfileState(
    C.useShallow(s => {
      const {platformGenericChecking, platformGenericParams, platformGenericURL, username} = s
      return {platformGenericChecking, platformGenericParams, platformGenericURL, username}
    })
  )
  const errorText = useProfileState(s => s.errorText)
  const _platformURL = platformGenericURL
  const error = errorText
  const serviceIcon = platformGenericParams?.logoBlack ?? []
  const serviceIconFull = platformGenericParams?.logoFull ?? []
  const serviceName = platformGenericParams?.title ?? ''
  const serviceSub = platformGenericParams?.subtext ?? ''
  const serviceSuffix = platformGenericParams?.suffix ?? ''
  const submitButtonLabel = platformGenericParams?.buttonLabel ?? 'Submit'
  const unreachable = !!platformGenericURL
  const waiting = platformGenericChecking

  const cancelAddProof = useProfileState(s => s.dispatch.dynamic.cancelAddProof)
  const updateUsername = useProfileState(s => s.dispatch.updateUsername)
  const submitUsername = useProfileState(s => s.dispatch.dynamic.submitUsername)

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onBack = () => {
    cancelAddProof?.()
    clearModals()
  }
  const onChangeUsername = updateUsername
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onContinue = React.useCallback(() => {
    navigateAppend('profileGenericProofResult')
  }, [navigateAppend])
  const _onSubmit = () => submitUsername?.()
  const onSubmit = _platformURL ? () => _platformURL && openURL(_platformURL) : _onSubmit
  const onCancel = onBack

  const [waitingButtonKey, setWaitingButtonKey] = React.useState(0)

  React.useEffect(() => {
    if (!waiting) {
      onContinue()
    }
    if (error) {
      setWaitingButtonKey(s => s + 1)
    }
  }, [waiting, error, onContinue])

  return (
    <Kb.PopupWrapper onCancel={onCancel}>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        {!unreachable && !Kb.Styles.isMobile && <Kb.BackButton onClick={onBack} style={styles.backButton} />}
        <Kb.Box2
          alignItems="center"
          direction="vertical"
          gap="xtiny"
          style={styles.serviceIconHeaderContainer}
        >
          <Kb.Box2 direction="vertical" style={styles.positionRelative}>
            <SiteIcon set={serviceIconFull} full={true} style={styles.serviceIconFull} />
            <Kb.Icon
              type={unreachable ? 'icon-proof-broken' : 'icon-proof-unfinished'}
              style={styles.serviceProofIcon}
            />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" alignItems="center" style={styles.serviceMeta}>
            <Kb.Text type="BodySemibold">{serviceName}</Kb.Text>
            <Kb.Text type="BodySmall" center={true}>
              {serviceSub}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2
          fullWidth={true}
          direction="vertical"
          alignItems="flex-start"
          gap="xtiny"
          style={styles.inputContainer}
        >
          {unreachable ? (
            <Unreachable serviceIcon={serviceIcon} serviceSuffix={serviceSuffix} username={username} />
          ) : (
            <EnterUsernameInput
              error={!!error}
              serviceIcon={serviceIcon}
              serviceSuffix={serviceSuffix}
              username={username}
              onChangeUsername={onChangeUsername}
              onEnterKeyDown={onSubmit}
            />
          )}
          {!!error && <Kb.Text type="BodySmallError">{error}</Kb.Text>}
        </Kb.Box2>
        <Kb.Box2
          alignItems="center"
          fullWidth={true}
          direction="vertical"
          style={unreachable ? styles.buttonBarWarning : null}
        >
          {unreachable && (
            <Kb.Text type="BodySmallSemibold" center={true} style={styles.warningText}>
              You need to authorize your proof on {serviceName}.
            </Kb.Text>
          )}
          <Kb.ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
            {!Kb.Styles.isMobile && !unreachable && (
              <Kb.Button type="Dim" onClick={onBack} label="Cancel" style={styles.buttonSmall} />
            )}
            {unreachable ? (
              <Kb.Button
                type="Success"
                onClick={onSubmit}
                label={submitButtonLabel}
                style={styles.buttonBig}
              />
            ) : (
              <Kb.WaitingButton
                type="Success"
                onClick={onSubmit}
                label={submitButtonLabel}
                style={styles.buttonBig}
                key={waitingButtonKey}
              />
            )}
          </Kb.ButtonBar>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.PopupWrapper>
  )
}

type InputProps = {
  error: boolean
  onChangeUsername: (arg0: string) => void
  onEnterKeyDown: () => void
  serviceIcon: T.Tracker.SiteIconSet
  serviceSuffix: string
  username: string
}

const EnterUsernameInput = (props: InputProps) => {
  const [focus, setFocus] = React.useState(false)
  const [username, setUsername] = React.useState(props.username)
  const {onChangeUsername: _onChangeUsername} = props

  const onChangeUsername = React.useCallback(
    (username: string) => {
      _onChangeUsername(username)
      setUsername(username)
    },
    [_onChangeUsername]
  )

  const onFocus = React.useCallback(() => setFocus(true), [])
  const onBlur = React.useCallback(() => setFocus(false), [])

  // If ever there become more than 2 choices, this can be pushed into a protocol parameter.
  const usernamePlaceholder = props.serviceSuffix === '@theqrl.org' ? 'Your QRL address' : 'Your username'
  return (
    <Kb.Box2
      direction="vertical"
      style={Kb.Styles.collapseStyles([
        styles.inputBox,
        username && styles.inputBoxSmall,
        focus && styles.borderBlue,
        props.error && styles.borderRed,
      ])}
      fullWidth={true}
    >
      {!!username && (
        <Kb.Text type="BodySmallSemibold" style={styles.colorBlue}>
          {usernamePlaceholder}
        </Kb.Text>
      )}
      <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={true}>
        <SiteIcon
          set={props.serviceIcon}
          full={false}
          style={username ? styles.opacity75 : styles.opacity40}
        />
        <Kb.Box2 direction="horizontal" style={styles.positionRelative} fullWidth={true}>
          <Kb.PlainInput
            autoFocus={true}
            flexable={true}
            textType="BodySemibold"
            value={username}
            onChangeText={onChangeUsername}
            onEnterKeyDown={props.onEnterKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            style={styles.input}
          />
          <Kb.Box2 direction="horizontal" style={styles.inputPlaceholder} pointerEvents="none">
            <Kb.Text type="BodySemibold" lineClamp={1} style={styles.paddingRightTiny}>
              <Kb.Text
                type="BodySemibold"
                style={Kb.Styles.collapseStyles([styles.placeholder, !!username && styles.invisible])}
              >
                {username || usernamePlaceholder}
              </Kb.Text>
              <Kb.Text type="BodySemibold" style={styles.placeholderService}>
                {props.serviceSuffix}
              </Kb.Text>
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const Unreachable = (props: {
  serviceIcon: T.Tracker.SiteIconSet
  serviceSuffix: string
  username: string
}) => (
  <Kb.Box2
    direction="horizontal"
    gap="xtiny"
    alignItems="flex-start"
    style={Kb.Styles.collapseStyles([styles.inputBox, styles.unreachableBox])}
    fullWidth={Kb.Styles.isMobile}
  >
    <SiteIcon
      set={props.serviceIcon}
      full={false}
      style={Kb.Styles.collapseStyles([styles.opacity75, styles.inlineIcon])}
    />
    <Kb.Box2 direction="vertical" style={styles.flexOne}>
      <Kb.Text type="BodySemibold" style={styles.unreachablePlaceholder}>
        <Kb.Text type="BodySemibold" style={styles.colorRed}>
          {props.username}
        </Kb.Text>
        {props.serviceSuffix}
      </Kb.Text>
      <Kb.Meta title="unreachable" backgroundColor={Kb.Styles.globalColors.red} />
    </Kb.Box2>
    <Kb.Icon
      type="iconfont-proof-broken"
      color={Kb.Styles.globalColors.red}
      boxStyle={styles.marginLeftAuto}
      style={styles.inlineIcon}
    />
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      backButton: {
        left: Kb.Styles.globalMargins.small,
        position: 'absolute',
        top: Kb.Styles.globalMargins.small,
      },
      borderBlue: {borderColor: Kb.Styles.globalColors.blue},
      borderRed: {borderColor: Kb.Styles.globalColors.red},
      buttonBar: {
        ...Kb.Styles.padding(
          Kb.Styles.globalMargins.small,
          Kb.Styles.globalMargins.medium,
          Kb.Styles.globalMargins.medium
        ),
      },
      buttonBarWarning: {backgroundColor: Kb.Styles.globalColors.yellow},
      buttonBig: {flex: 2.5},
      buttonSmall: {flex: 1},
      colorBlue: {color: Kb.Styles.globalColors.blueDark},
      colorRed: {color: Kb.Styles.globalColors.redDark},
      container: Kb.Styles.platformStyles({isElectron: {height: 485, width: 560}}),
      flexOne: {flex: 1},
      inlineIcon: {
        position: 'relative',
        top: 1,
      },
      input: Kb.Styles.platformStyles({
        common: {marginRight: Kb.Styles.globalMargins.medium},
        isAndroid: {top: 1},
        isElectron: {marginTop: -1},
      }),
      inputBox: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall),
        borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        padding: Kb.Styles.globalMargins.xsmall,
      },
      inputBoxSmall: {...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall)},
      inputContainer: {
        ...Kb.Styles.padding(
          0,
          Kb.Styles.isMobile ? Kb.Styles.globalMargins.small : Kb.Styles.globalMargins.medium
        ),
        flex: 1,
        justifyContent: 'center',
      },
      inputPlaceholder: {
        left: 1,
        position: 'absolute',
        right: 0,
        top: 1,
      },
      invisible: {
        // opacity doesn't work in nested Text on android
        // see here: https://github.com/facebook/react-native/issues/18057
        color: Kb.Styles.globalColors.transparent,
      },
      marginLeftAuto: {marginLeft: 'auto'},
      opacity40: {opacity: 0.4},
      opacity75: {opacity: 0.75},
      paddingRightTiny: {paddingRight: Kb.Styles.globalMargins.tiny},
      placeholder: {color: Kb.Styles.globalColors.black_35},
      placeholderService: {color: Kb.Styles.globalColors.black_20},
      positionRelative: {position: 'relative'},
      serviceIconFull: {
        height: 64,
        width: 64,
      },
      serviceIconHeaderContainer: {paddingTop: Kb.Styles.globalMargins.medium},
      serviceMeta: Kb.Styles.platformStyles({
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.medium,
          paddingRight: Kb.Styles.globalMargins.medium,
        },
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      serviceProofIcon: {
        bottom: -Kb.Styles.globalMargins.tiny,
        position: 'absolute',
        right: -Kb.Styles.globalMargins.tiny,
      },
      unreachableBox: Kb.Styles.platformStyles({
        common: {...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall)},
        isElectron: {width: 360},
      }),
      unreachablePlaceholder: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.black_35},
        isElectron: {wordBreak: 'break-all'},
      }),
      warningText: {color: Kb.Styles.globalColors.brown_75, marginTop: Kb.Styles.globalMargins.small},
    }) as const
)

export default ConnectedEnterUsername
