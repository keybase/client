import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Kb from '../../../common-adapters'
import {fileUIName} from '../../../constants/platform'
import * as Flow from '../../../util/flow'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as FsGen from '../../../actions/fs-gen'
import * as Platform from '../../../constants/platform'
import * as Waiting from '../../../constants/waiting'
import * as Kbfs from '../../common'

/*
 * This banner is used as part of a list in folder view and it's important to
 * have accurate height measured. If you change layout that results in height
 * change, please remember to update height accordingly.
 *
 */
export const height = 224

type Props = {
  alwaysShow?: boolean | null
  driverStatus: Types.DriverStatus
  settings: Types.Settings
  onAcknowledge: () => void
  onAcknowledgeAndDismiss: () => void
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
  onDismiss?: (() => void) | null
  title: string
  body?: string | null
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
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(background)
      return styles.textWhite
  }
}

const backgroundToBackgroundColor = (background: Background) => {
  switch (background) {
    case Background.Blue:
      return Styles.globalColors.blue
    case Background.Green:
      return Styles.globalColors.green
    case Background.Yellow:
      return Styles.globalColors.yellow
    case Background.Black:
      return Styles.globalColors.black
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(background)
      return Styles.globalColors.black
  }
}

const Banner = (props: BannerProps) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    centerChildren={true}
    style={Styles.collapseStyles([
      styles.container,
      {backgroundColor: backgroundToBackgroundColor(props.background)},
    ])}
  >
    <Kb.Icon
      type={props.okIcon ? 'icon-fancy-finder-enabled-132-96' : 'icon-fancy-finder-132-96'}
      style={styles.fancyIcon}
    />
    <Kb.Box2
      direction="vertical"
      gap="small"
      fullHeight={true}
      style={styles.bodyContainer}
      centerChildren={true}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
        <Kb.Text type="Header" style={backgroundToTextStyle(props.background)}>
          {props.title}
        </Kb.Text>
        {props.body && (
          <Kb.Box style={Styles.globalStyles.flexGrow}>
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
    <Kb.Box style={Styles.globalStyles.flexGrow} />
    {!!props.onDismiss && (
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <Kb.Icon
          type="iconfont-close"
          onClick={props.onDismiss}
          color={Styles.globalColors.white_40}
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
  if (props.driverStatus.type !== Types.DriverStatusType.Enabled) {
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

const FuseNotOpenSourceWarningWhenAlreadyEnabled = (props: Props) => {
  const ackWaiting = Container.useSelector(state =>
    Waiting.anyWaiting(state, Constants.acceptMacOSFuseExtClosedSourceWaitingKey)
  )

  if (props.driverStatus.type !== Types.DriverStatusType.Enabled) {
    return <ThisShouldNotHappen />
  }

  return (
    <Banner
      background={Background.Yellow}
      okIcon={false}
      title="Note: FUSE for macOS is not opensource"
      body={`Keybase in ${fileUIName} is supported by a third-party software called FUSE for macOS (osxfuse). This software is not opensource anymore. Please acknowledge that you are OK with it, or disable ${fileUIName} integration.`}
      button={{
        action: props.onAcknowledgeAndDismiss,
        buttonText: "I'm OK with it",
        inProgress: ackWaiting,
      }}
      buttonSecondary={{
        action: props.onDisable,
        buttonText: `Disable ${fileUIName} integration`,
        inProgress: props.driverStatus.isDisabling,
      }}
    />
  )
}

type JustEnabledProps = {onDismiss: null | (() => void)}
const JustEnabled = ({onDismiss}: JustEnabledProps) => {
  const preferredMountDirs = Container.useSelector(state => state.fs.sfmi.preferredMountDirs)
  const displayingMountDir = preferredMountDirs[0] || ''
  const dispatch = Container.useDispatch()
  const open = displayingMountDir
    ? () => dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: displayingMountDir}))
    : undefined
  return (
    <Banner
      background={Background.Green}
      okIcon={true}
      title={`Keybase is enabled in your ${fileUIName}.`}
      body={displayingMountDir ? `Your files are accessible at ${displayingMountDir}.` : undefined}
      onDismiss={onDismiss}
      button={
        open
          ? {
              action: open,
              buttonText: `Open in ${fileUIName}`,
              inProgress: false,
            }
          : undefined
      }
    />
  )
}

const Enabled = (props: Props) => {
  if (props.driverStatus.type !== Types.DriverStatusType.Enabled) {
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
      <Banner background={Background.Blue} okIcon={false} title={`Disabling Keybase in ${fileUIName} ...`} />
    )
  }
  if (Platform.isDarwin && !props.settings.macOSFuseExtAcceptedClosedSource) {
    return <FuseNotOpenSourceWarningWhenAlreadyEnabled {...props} />
  }
  if (props.alwaysShow || props.driverStatus.isNew) {
    return <JustEnabled onDismiss={props.alwaysShow ? null : props.onDismiss} />
  }
  return null
}

const Disabled = (props: Props) => {
  const [agreed, setAgreed] = React.useState<boolean>(false)

  if (props.driverStatus.type !== Types.DriverStatusType.Disabled) {
    return <ThisShouldNotHappen />
  }

  return (
    <Banner
      background={Background.Blue}
      okIcon={false}
      title={`Enable Keybase in ${fileUIName}?`}
      body="Get access to your files and folders just like you normally do with your local files. It's encrypted and secure."
      bodyExtraComponent={
        Platform.isDarwin ? (
          <Kb.Switch
            style={styles.agree}
            color="red"
            disabled={props.driverStatus.isEnabling}
            on={agreed}
            onClick={() => setAgreed(a => !a)}
            gapSize={Styles.globalMargins.small}
            label={
              <Kb.Text
                type="BodySmall"
                style={backgroundToTextStyle(Background.Blue)}
                onClick={() => setAgreed(a => !a)}
              >
                {`I understand Fuse for macOS (osxfuse) will be installed, and that Fuse for macOS is not opensource software.`}
              </Kb.Text>
            }
          />
        ) : (
          undefined
        )
      }
      button={{
        action: () => {
          props.onAcknowledge()
          props.onEnable()
        },
        buttonText: 'Yes, enable',
        disabled: Platform.isDarwin && !agreed,
        inProgress: props.driverStatus.isEnabling,
      }}
      onDismiss={props.alwaysShow ? null : props.onDismiss}
    />
  )
}

export default (props: Props) => {
  if (!Constants.sfmiInfoLoaded(props.settings, props.driverStatus)) {
    return props.alwaysShow ? (
      <Banner
        background={Background.Blue}
        okIcon={false}
        title="Loading"
        body={`Trying to find out if Keybase is enabled in ${fileUIName} ...`}
      />
    ) : null
  }

  switch (props.driverStatus.type) {
    case Types.DriverStatusType.Disabled:
      return props.alwaysShow || !props.settings.sfmiBannerDismissed ? <Disabled {...props} /> : null
    case Types.DriverStatusType.Enabled:
      return props.alwaysShow || !props.settings.sfmiBannerDismissed ? <Enabled {...props} /> : null
    case Types.DriverStatusType.Unknown:
      return <ThisShouldNotHappen />
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      agree: {},
      bodyContainer: {
        maxWidth: Styles.globalMargins.large * 14 + Styles.globalMargins.mediumLarge * 2,
        padding: Styles.globalMargins.mediumLarge,
      },
      container: {
        height,
        maxHeight: height,
        minHeight: height,
      },
      dismissIcon: Styles.platformStyles({
        isElectron: {
          display: 'block',
          padding: Styles.globalMargins.tiny,
        },
      }),
      fancyIcon: {
        paddingLeft: Styles.globalMargins.large + Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.small,
      },
      textBrown: {
        color: Styles.globalColors.brown_75,
      },
      textWhite: {
        color: Styles.globalColors.white,
      },
    } as const)
)
