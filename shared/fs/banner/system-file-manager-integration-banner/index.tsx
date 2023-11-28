import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as Kbfs from '@/fs/common'

type Props = {
  alwaysShow?: boolean
  driverStatus: T.FS.DriverStatus
  settings: T.FS.Settings
  onDisable: () => void
  onDismiss: () => void
  onEnable: () => void
}

enum Background {
  Blue = 'blue',
  Green = 'green',
  Yellow = 'yellow',
  Black = 'black',
}

type BannerButtonProps = {
  action: () => void
  buttonText: string
  disabled?: boolean
  inProgress: boolean
}

type BannerProps = {
  background: Background
  okIcon: boolean
  onDismiss?: () => void
  title: string
  body?: string
  bodyExtraComponent?: React.ReactNode
  button?: BannerButtonProps
  buttonSecondary?: BannerButtonProps
}

const backgroundToTextStyle = (background: Background) => {
  switch (background) {
    case Background.Blue:
      return styles.textWhite
    case Background.Green:
      return styles.textWhite
    case Background.Yellow:
      return styles.textBrown
    case Background.Black:
      return styles.textWhite
    default:
      return styles.textWhite
  }
}

const backgroundToBackgroundColor = (background: Background) => {
  switch (background) {
    case Background.Blue:
      return Kb.Styles.globalColors.blue
    case Background.Green:
      return Kb.Styles.globalColors.green
    case Background.Yellow:
      return Kb.Styles.globalColors.yellow
    case Background.Black:
      return Kb.Styles.globalColors.black
    default:
      return Kb.Styles.globalColors.black
  }
}

const Banner = (props: BannerProps) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    centerChildren={true}
    style={{backgroundColor: backgroundToBackgroundColor(props.background)}}
  >
    <Kb.Icon
      type={props.okIcon ? 'icon-fancy-finder-enabled-132-96' : 'icon-fancy-finder-132-96'}
      style={styles.fancyIcon}
    />
    <Kb.Box2 direction="vertical" gap="small" fullHeight={true} style={styles.bodyContainer}>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
        <Kb.Text type="Header" style={backgroundToTextStyle(props.background)}>
          {props.title}
        </Kb.Text>
        {props.body && (
          <Kb.Box style={Kb.Styles.globalStyles.flexGrow}>
            <Kb.Text type="Body" style={backgroundToTextStyle(props.background)}>
              {props.body}
            </Kb.Text>
          </Kb.Box>
        )}
      </Kb.Box2>
      {props.bodyExtraComponent ?? false}
      {!!(props.button || props.buttonSecondary) && (
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="small" alignItems="center">
          {!!props.button && (
            <Kb.Button
              backgroundColor={props.background}
              disabled={props.button.disabled}
              label={props.button.buttonText}
              onClick={props.button.action}
              waiting={props.button.inProgress}
            />
          )}
          {!!props.buttonSecondary && (
            <Kb.Button
              backgroundColor={props.background}
              disabled={props.buttonSecondary.disabled}
              label={props.buttonSecondary.buttonText}
              onClick={props.buttonSecondary.action}
              waiting={props.buttonSecondary.inProgress}
            />
          )}
        </Kb.Box2>
      )}
    </Kb.Box2>
    <Kb.Box style={Kb.Styles.globalStyles.flexGrow} />
    {!!props.onDismiss && (
      <Kb.Box2 direction="vertical" alignSelf="flex-start">
        <Kb.Icon
          type="iconfont-close"
          onClick={props.onDismiss}
          color={Kb.Styles.globalColors.white_40}
          fontSize={16}
          style={styles.dismissIcon}
        />
      </Kb.Box2>
    )}
  </Kb.Box2>
)

const ThisShouldNotHappen = () => (
  <Banner background={Background.Black} okIcon={false} title="This should not happen." />
)

const DokanOutdated = (props: Props) => {
  if (props.driverStatus.type !== T.FS.DriverStatusType.Enabled) {
    return <ThisShouldNotHappen />
  }
  return (
    <Banner
      background={Background.Yellow}
      okIcon={false}
      title="Dokan is outdated."
      body={
        props.driverStatus.dokanUninstallExecPath
          ? 'A newer version of Dokan is available. It is reccomended that the current version be uninstalled before installing this update.'
          : 'A newer version of Dokan is available. Please remove the old version before installing it.'
      }
      button={
        props.driverStatus.dokanUninstallExecPath
          ? {
              action: props.onDisable,
              buttonText: 'Yes, uninstall',
              inProgress: props.driverStatus.isDisabling,
            }
          : undefined
      }
    />
  )
}

type JustEnabledProps = {onDismiss?: () => void}
const JustEnabled = ({onDismiss}: JustEnabledProps) => {
  const preferredMountDirs = C.useFSState(s => s.sfmi.preferredMountDirs)
  const displayingMountDir = preferredMountDirs[0] || ''
  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const open = displayingMountDir
    ? () => openLocalPathInSystemFileManagerDesktop?.(displayingMountDir)
    : undefined
  return (
    <Banner
      background={Background.Green}
      okIcon={true}
      title={`Keybase is enabled in your ${C.fileUIName}.`}
      body={displayingMountDir ? `Your files are accessible at ${displayingMountDir}.` : undefined}
      onDismiss={onDismiss}
      button={
        open
          ? {
              action: open,
              buttonText: `Open in ${C.fileUIName}`,
              inProgress: false,
            }
          : undefined
      }
    />
  )
}

const Enabled = (props: Props) => {
  if (props.driverStatus.type !== T.FS.DriverStatusType.Enabled) {
    return <ThisShouldNotHappen />
  }
  if (props.driverStatus.dokanOutdated) {
    return <DokanOutdated {...props} />
  }
  if (props.driverStatus.isDisabling) {
    // We already covered the dokan-uninstall disable case above, so this'd be
    // the rare case where user disables finder integration, and goes to Files
    // tab before it's done. Just show a simple banner in this case.
    return (
      <Banner
        background={Background.Blue}
        okIcon={false}
        title={`Disabling Keybase in ${C.fileUIName} ...`}
      />
    )
  }
  if (props.alwaysShow || !props.settings.sfmiBannerDismissed) {
    return <JustEnabled onDismiss={props.alwaysShow ? undefined : props.onDismiss} />
  }
  return null
}

const Disabled = (props: Props) => {
  const {canContinue, component} = Kbfs.useFuseClosedSourceConsent(
    props.driverStatus.type === T.FS.DriverStatusType.Disabled && props.driverStatus.isEnabling,
    Kb.Styles.globalColors.blue,
    backgroundToTextStyle(Background.Blue)
  )
  if (props.driverStatus.type !== T.FS.DriverStatusType.Disabled) {
    return <ThisShouldNotHappen />
  }

  return (
    <Banner
      background={Background.Blue}
      okIcon={false}
      title={`Enable Keybase in ${C.fileUIName}?`}
      body="Get access to your files and folders just like you normally do with your local files. It's encrypted and secure."
      bodyExtraComponent={component}
      button={{
        action: props.onEnable,
        buttonText: 'Yes, enable',
        disabled: !canContinue,
        inProgress: props.driverStatus.isEnabling,
      }}
      onDismiss={props.alwaysShow ? undefined : props.onDismiss}
    />
  )
}

const SFMIBanner = (props: Props) => {
  if (!Constants.sfmiInfoLoaded(props.settings, props.driverStatus)) {
    return props.alwaysShow ? (
      <Banner
        background={Background.Blue}
        okIcon={false}
        title="Loading"
        body={`Trying to find out if Keybase is enabled in ${C.fileUIName} ...`}
      />
    ) : null
  }

  switch (props.driverStatus.type) {
    case T.FS.DriverStatusType.Disabled:
      return props.alwaysShow || !props.settings.sfmiBannerDismissed ? <Disabled {...props} /> : null
    case T.FS.DriverStatusType.Enabled:
      return props.alwaysShow || !props.settings.sfmiBannerDismissed ? <Enabled {...props} /> : null
    case T.FS.DriverStatusType.Unknown:
      return <ThisShouldNotHappen />
  }
}
export default SFMIBanner

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bodyContainer: {
        justifyContent: 'center',
        maxWidth: Kb.Styles.globalMargins.large * 14 + Kb.Styles.globalMargins.mediumLarge * 2,
        padding: Kb.Styles.globalMargins.mediumLarge,
      },
      dismissIcon: Kb.Styles.platformStyles({
        isElectron: {
          display: 'block',
          padding: Kb.Styles.globalMargins.tiny,
        },
      }),
      fancyIcon: {
        marginBottom: Kb.Styles.globalMargins.medium,
        marginTop: Kb.Styles.globalMargins.medium,
        paddingLeft: Kb.Styles.globalMargins.large + Kb.Styles.globalMargins.tiny,
        paddingRight: Kb.Styles.globalMargins.small,
      },
      textBrown: {
        color: Kb.Styles.globalColors.brown_75,
      },
      textWhite: {
        color: Kb.Styles.globalColors.white,
      },
    }) as const
)
