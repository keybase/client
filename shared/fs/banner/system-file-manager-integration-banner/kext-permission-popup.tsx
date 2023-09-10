import * as React from 'react'
import * as T from '../../../constants/types'
import * as Kb from '../../../common-adapters'

type Props = {
  driverStatus: T.FS.DriverStatus
  onCancel: () => void // must be ownProps.navigateUp() or idempotent in a way
  openSecurityPrefs: () => void
}

const Illustration = () => (
  <Kb.Box style={styles.illustrationContainer}>
    <Kb.Icon style={styles.image} type="illustration-security-preferences" />
    <Kb.Box
      style={Kb.Styles.collapseStyles([styles.highlight, {bottom: 49, height: 24, left: 36, width: 136}])}
    />
    <Kb.Text
      type="BodySemibold"
      style={Kb.Styles.collapseStyles([styles.numberList, {bottom: 42, left: 158, position: 'absolute'}])}
    >
      1
    </Kb.Text>
    <Kb.Box
      style={Kb.Styles.collapseStyles([styles.highlight, {bottom: 105, height: 24, left: 290, width: 72}])}
    />
    <Kb.Text
      type="BodySemibold"
      style={Kb.Styles.collapseStyles([styles.numberList, {bottom: 96, left: 350, position: 'absolute'}])}
    >
      2
    </Kb.Text>
  </Kb.Box>
)

class CancelWhenEnabled extends React.PureComponent<Props> {
  _cancelOnEnabled = () =>
    this.props.driverStatus.type === T.FS.DriverStatusType.Enabled && this.props.onCancel()
  componentDidMount() {
    this._cancelOnEnabled()
  }
  componentDidUpdate() {
    this._cancelOnEnabled()
  }
  render() {
    return null
  }
}

const InstallSecurityPrefs = (props: Props) => (
  <Kb.PopupWrapper onCancel={props.onCancel}>
    <>
      <CancelWhenEnabled {...props} />
      <Kb.Box2 direction="vertical" gap="small" centerChildren={true} style={styles.container}>
        <Kb.Text type="HeaderBig" style={styles.title}>
          You need to change your system security preferences.
        </Kb.Text>
        <Kb.Text type="Body">Open your macOS Security & Privacy Settings and follow these steps.</Kb.Text>
        <Kb.Box2 direction="horizontal">
          <Illustration />
          <Kb.Box2 direction="vertical" fullHeight={true} style={styles.numberListContainer}>
            <Kb.Box style={Kb.Styles.globalStyles.flexBoxRow}>
              <Kb.Text type="BodySemibold" style={styles.numberList}>
                1
              </Kb.Text>
              <Kb.Text type="BodySemibold" style={styles.listText}>
                Click the lock icon then enter your password
              </Kb.Text>
            </Kb.Box>
            <Kb.Box style={Kb.Styles.globalStyles.flexBoxRow}>
              <Kb.Text type="BodySemibold" style={styles.numberList}>
                2
              </Kb.Text>
              <Kb.Text type="BodySemibold" style={styles.listText}>
                Click "Allow"
              </Kb.Text>
            </Kb.Box>
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Text type="BodySemiboldLink" onClick={props.openSecurityPrefs}>
          Open Security & Privacy Settings
        </Kb.Text>
      </Kb.Box2>
      {props.driverStatus.type === T.FS.DriverStatusType.Disabled && props.driverStatus.isEnabling && (
        <Kb.Box style={styles.enablingContainer}>
          <Kb.Box2 direction="vertical" gap="small" fullWidth={true} fullHeight={true} centerChildren={true}>
            <Kb.ProgressIndicator type="Small" white={true} />
            <Kb.Text type="BodySmall" negative={true}>
              Checking ...
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box>
      )}
    </>
  </Kb.PopupWrapper>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        maxWidth: 700,
        minWidth: 700,
        paddingBottom: Kb.Styles.globalMargins.mediumLarge,
        paddingLeft: Kb.Styles.globalMargins.large,
        paddingRight: Kb.Styles.globalMargins.large,
        paddingTop: Kb.Styles.globalMargins.mediumLarge,
        width: 700,
      },
      enablingContainer: {
        backgroundColor: Kb.Styles.globalColors.black_63,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      highlight: {
        backgroundColor: Kb.Styles.globalColors.black_05,
        borderColor: Kb.Styles.globalColors.blue,
        borderRadius: Kb.Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 2,
        position: 'absolute',
      },
      illustrationContainer: {
        position: 'relative',
      },
      image: {
        width: 408,
      },
      listText: {
        paddingBottom: 16,
        paddingTop: 1,
      },
      numberList: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.blue,
          borderRadius: '50%',
          color: Kb.Styles.globalColors.white,
          height: 20,
          marginRight: 13,
          minWidth: 20,
          paddingTop: 1,
          textAlign: 'center',
          width: 20,
        },
      }),
      numberListContainer: {
        paddingTop: Kb.Styles.globalMargins.large,
      },
      title: {
        maxWidth: 480,
        textAlign: 'center',
      },
    }) as const
)

export default InstallSecurityPrefs
