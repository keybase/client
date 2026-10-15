import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as Kbfs from '@/fs/common'
import * as FS from '@/constants/fs'
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'

type OwnProps = {alwaysShow?: boolean}

const SFMIContainer = (op: OwnProps) => {
  const {
    driverDisable,
    driverEnable,
    driverStatus,
    settingsLoaded,
    setSfmiBannerDismissed,
    sfmiBannerDismissed,
  } = Kbfs.useSystemFileManagerIntegration()
  const onDismiss = () => setSfmiBannerDismissed(true)
  const alwaysShow = op.alwaysShow

  if (!FS.sfmiInfoLoaded({loaded: settingsLoaded}, driverStatus)) {
    return alwaysShow ? (
      <Banner
        background={Background.Blue}
        okIcon={false}
        title="Loading"
        body={`Trying to find out if Keybase is enabled in ${C.fileUIName} ...`}
      />
    ) : null
  }

  switch (driverStatus.type) {
    case T.FS.DriverStatusType.Disabled:
      return alwaysShow || !sfmiBannerDismissed ? (
        <Disabled
          driverStatus={driverStatus}
          onEnable={driverEnable}
          alwaysShow={alwaysShow}
          onDismiss={onDismiss}
        />
      ) : null
    case T.FS.DriverStatusType.Enabled:
      return alwaysShow || !sfmiBannerDismissed ? (
        <Enabled
          driverStatus={driverStatus}
          onDisable={driverDisable}
          alwaysShow={alwaysShow}
          sfmiBannerDismissed={sfmiBannerDismissed}
          onDismiss={onDismiss}
        />
      ) : null
    case T.FS.DriverStatusType.Unknown:
      return <ThisShouldNotHappen />
  }
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
  inProgress: boolean
}

type BannerProps = {
  background: Background
  okIcon: boolean
  onDismiss?: () => void
  title: string
  body?: string
  button?: BannerButtonProps
}

const backgroundToTextStyle = (background: Background, styles: ReturnType<typeof useStyles>) => {
  switch (background) {
    case Background.Blue:
    case Background.Green:
    case Background.Black:
      return styles.textWhite
    case Background.Yellow:
      return styles.textBrown
  }
}

const backgroundToBackgroundColor = (background: Background, theme: Kb.Styles.Theme) => {
  switch (background) {
    case Background.Blue:
      return theme.blue
    case Background.Green:
      return theme.green
    case Background.Yellow:
      return theme.yellow
    case Background.Black:
      return theme.black
  }
}

const backgroundToButtonLabelStyle = (background: Background, theme: Kb.Styles.Theme) => {
  switch (background) {
    case Background.Blue:
      return {color: theme.blueDark}
    case Background.Green:
      return {color: theme.greenDark}
    case Background.Yellow:
      return {color: theme.brown_75OrYellow}
    case Background.Black:
      return {color: theme.black}
  }
}

const Banner = (props: BannerProps) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      centerChildren={true}
      style={{backgroundColor: backgroundToBackgroundColor(props.background, theme)}}
    >
      <Kb.IconAuto
        type={props.okIcon ? 'icon-fancy-finder-enabled-132-96' : 'icon-fancy-finder-132-96'}
        style={styles.fancyIcon}
      />
      <Kb.Box2 direction="vertical" gap="small" fullHeight={true} padding="mediumLarge" style={styles.bodyContainer} justifyContent="center">
        <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
          <Kb.Text type="Header" style={backgroundToTextStyle(props.background, styles)}>
            {props.title}
          </Kb.Text>
          {props.body && (
            <Kb.Box2 alignSelf="center" direction="vertical" style={Kb.Styles.globalStyles.flexGrow}>
              <Kb.Text type="Body" style={backgroundToTextStyle(props.background, styles)}>
                {props.body}
              </Kb.Text>
            </Kb.Box2>
          )}
        </Kb.Box2>
        {!!props.button && (
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="small" alignItems="center">
            <Kb.Button
              label={props.button.buttonText}
              onClick={props.button.action}
              waiting={props.button.inProgress}
              style={styles.buttonOnColor}
              labelStyle={backgroundToButtonLabelStyle(props.background, theme)}
            />
          </Kb.Box2>
        )}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" style={Kb.Styles.globalStyles.flexGrow} />
      {!!props.onDismiss && (
        <Kb.Box2 direction="vertical" alignSelf="flex-start">
          <Kb.Icon
            type="iconfont-close"
            onClick={props.onDismiss}
            color={theme.white_40}
            fontSize={16}
            style={styles.dismissIcon}
          />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const ThisShouldNotHappen = () => (
  <Banner background={Background.Black} okIcon={false} title="This should not happen." />
)

const DokanOutdated = (props: {driverStatus: T.FS.DriverStatus; onDisable: () => void}) => {
  const {driverStatus, onDisable} = props
  if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
    return <ThisShouldNotHappen />
  }
  return (
    <Banner
      background={Background.Yellow}
      okIcon={false}
      title="Dokan is outdated."
      body={
        driverStatus.dokanUninstallExecPath
          ? 'A newer version of Dokan is available. It is reccomended that the current version be uninstalled before installing this update.'
          : 'A newer version of Dokan is available. Please remove the old version before installing it.'
      }
      button={
        driverStatus.dokanUninstallExecPath
          ? {
              action: onDisable,
              buttonText: 'Yes, uninstall',
              inProgress: driverStatus.isDisabling,
            }
          : undefined
      }
    />
  )
}

type JustEnabledProps = {onDismiss?: () => void}
const JustEnabled = ({onDismiss}: JustEnabledProps) => {
  const errorToActionOrThrow = Kbfs.useFsErrorActionOrThrow()
  const {directMountDir, preferredMountDirs} = Kbfs.useSystemFileManagerIntegration()
  // macOS has no preferred (redirector) mount dirs, only the mount itself
  const displayingMountDir = C.isDarwin ? directMountDir : (preferredMountDirs[0] ?? '')
  const open = displayingMountDir
    ? () => openLocalPathInSystemFileManagerDesktop(displayingMountDir, errorToActionOrThrow)
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

const Enabled = (props: {
  driverStatus: T.FS.DriverStatus
  onDisable: () => void
  alwaysShow?: boolean
  sfmiBannerDismissed: boolean
  onDismiss: () => void
}) => {
  const {driverStatus, onDisable, alwaysShow, sfmiBannerDismissed, onDismiss} = props
  if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
    return <ThisShouldNotHappen />
  }
  if (driverStatus.dokanOutdated) {
    return <DokanOutdated driverStatus={driverStatus} onDisable={onDisable} />
  }
  if (driverStatus.isDisabling) {
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
  if (alwaysShow || !sfmiBannerDismissed) {
    return <JustEnabled onDismiss={alwaysShow ? undefined : onDismiss} />
  }
  return null
}

const MacfuseNotReady = (props: {copy: Kbfs.MacfusePromptCopy; onDismiss?: () => void}) => {
  const {copy, onDismiss} = props
  const {action, actionLabel, body, title} = copy
  const onAction = Kbfs.useMacfuseAction(action)
  return (
    <Banner
      background={Background.Blue}
      okIcon={false}
      title={title}
      body={body}
      button={{action: onAction, buttonText: actionLabel, inProgress: false}}
      onDismiss={onDismiss}
    />
  )
}

const enableBody =
  "Get access to your files and folders just like you normally do with your local files. It's encrypted and secure."

const Disabled = (props: {
  driverStatus: T.FS.DriverStatus
  onEnable: () => void
  alwaysShow?: boolean
  onDismiss: () => void
}) => {
  const {driverStatus, onEnable, alwaysShow, onDismiss} = props
  if (driverStatus.type !== T.FS.DriverStatusType.Disabled) {
    return <ThisShouldNotHappen />
  }
  const macfuseCopy = Kbfs.macfusePromptCopy(driverStatus)
  if (macfuseCopy) {
    return <MacfuseNotReady copy={macfuseCopy} onDismiss={alwaysShow ? undefined : onDismiss} />
  }

  return (
    <Banner
      background={Background.Blue}
      okIcon={false}
      title={`Enable Keybase in ${C.fileUIName}?`}
      body={C.isDarwin ? `${enableBody} ${Kbfs.macfuseNetworkVolumeNote}` : enableBody}
      button={{
        action: onEnable,
        buttonText: 'Yes, enable',
        inProgress: driverStatus.isEnabling,
      }}
      onDismiss={alwaysShow ? undefined : onDismiss}
    />
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      bodyContainer: {
        maxWidth: Kb.Styles.globalMargins.large * 14 + Kb.Styles.globalMargins.mediumLarge * 2,
      },
      buttonOnColor: {backgroundColor: theme.white},
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
      textBrown: {color: theme.brown_75},
      textWhite: {color: theme.white},
    }) as const
)

export default SFMIContainer
