import * as C from '@/constants'
import {type ProveGenericParams, useProfileState} from '@/stores/profile'
import {openURL} from '@/util/misc'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SiteIcon} from './shared'
import type * as T from '@/constants/types'

type Props = {
  route: {
    params: {
      error?: string
      genericParams: ProveGenericParams
      proofUrl?: string
      service: string
      username?: string
    }
  }
}

const ConnectedEnterUsername = ({route}: Props) => {
  const {error = '', genericParams, proofUrl, username: routeUsername = ''} = route.params
  const serviceIcon = genericParams.logoBlack ?? []
  const serviceIconFull = genericParams.logoFull ?? []
  const serviceName = genericParams.title ?? ''
  const serviceSub = genericParams.subtext ?? ''
  const serviceSuffix = genericParams.suffix ?? ''
  const submitButtonLabel = genericParams.buttonLabel ?? 'Submit'
  const unreachable = !!proofUrl

  const cancelAddProof = useProfileState(s => s.dispatch.dynamic.cancelAddProof)
  const submitUsername = useProfileState(s => s.dispatch.dynamic.submitUsername)

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onBack = () => {
    cancelAddProof?.()
    clearModals()
  }
  const [username, setUsername] = React.useState(routeUsername)
  const onSubmit = proofUrl ? () => openURL(proofUrl) : () => submitUsername?.(username)

  React.useEffect(() => {
    setUsername(routeUsername)
  }, [routeUsername])

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        {!unreachable && !Kb.Styles.isMobile && <Kb.BackButton onClick={onBack} style={styles.backButton} />}
        <Kb.Box2
          alignItems="center"
          direction="vertical"
          gap="xtiny"
          style={styles.serviceIconHeaderContainer}
        >
          <Kb.Box2 direction="vertical" relative={true}>
            <SiteIcon set={serviceIconFull} full={true} style={styles.serviceIconFull} />
            <Kb.IconAuto
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
          justifyContent="center"
          flex={1}
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
              onChangeUsername={setUsername}
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
                waitingKey={C.waitingKeyProfile}
              />
            )}
          </Kb.ButtonBar>
        </Kb.Box2>
      </Kb.Box2>
    </>
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
  const usernamePlaceholder = props.serviceSuffix === '@theqrl.org' ? 'Your QRL address' : 'Your username'
  return (
    <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={true}>
      <SiteIcon
        set={props.serviceIcon}
        full={false}
        style={props.username ? styles.opacity75 : styles.opacity40}
      />
      <Kb.Input3
        autoFocus={true}
        value={props.username}
        onChangeText={props.onChangeUsername}
        onEnterKeyDown={props.onEnterKeyDown}
        placeholder={usernamePlaceholder}
        error={props.error}
        decoration={
          <Kb.Text type="BodySemibold" style={styles.placeholderService}>
            {props.serviceSuffix}
          </Kb.Text>
        }
      />
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
    <Kb.Box2 direction="vertical" flex={1}>
      <Kb.Text type="BodySemibold" style={styles.unreachablePlaceholder}>
        <Kb.Text type="BodySemibold" style={styles.colorRed}>
          {props.username}
        </Kb.Text>
        {props.serviceSuffix}
      </Kb.Text>
      <Kb.Meta title="unreachable" backgroundColor={Kb.Styles.globalColors.red} />
    </Kb.Box2>
    <Kb.Box2 direction="vertical" style={styles.marginLeftAuto}>
      <Kb.Icon
        type="iconfont-proof-broken"
        color={Kb.Styles.globalColors.red}
        style={styles.inlineIcon}
      />
    </Kb.Box2>
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
      colorRed: {color: Kb.Styles.globalColors.redDark},
      container: {},

      inlineIcon: {
        position: 'relative',
        top: 1,
      },
      inputBox: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall),
        borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        padding: Kb.Styles.globalMargins.xsmall,
      },
      inputContainer: {
        ...Kb.Styles.padding(
          0,
          Kb.Styles.isMobile ? Kb.Styles.globalMargins.small : Kb.Styles.globalMargins.medium
        ),
      },
      marginLeftAuto: {marginLeft: 'auto'},
      opacity40: {opacity: 0.4},
      opacity75: {opacity: 0.75},
      placeholderService: {color: Kb.Styles.globalColors.black_20},
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
