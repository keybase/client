import React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  driverStatus: Types.DriverStatus
  onCancel: () => void // must be ownProps.navigateUp() or idempotent in a way
  openSecurityPrefs: () => void
}

const securityPreferenceIllustration = require('../../../images/illustrations/security-preferences.png')

const Illustration = () => (
  <Kb.Box style={styles.illustrationContainer}>
    <Kb.Image style={styles.image} resizeMode="contain" src={securityPreferenceIllustration} />
    <Kb.Box
      style={Styles.collapseStyles([styles.highlight, {bottom: 49, height: 24, left: 36, width: 136}])}
    />
    <Kb.Text
      type="BodySemibold"
      style={Styles.collapseStyles([styles.numberList, {bottom: 42, left: 158, position: 'absolute'}])}
    >
      1
    </Kb.Text>
    <Kb.Box
      style={Styles.collapseStyles([styles.highlight, {bottom: 105, height: 24, left: 290, width: 72}])}
    />
    <Kb.Text
      type="BodySemibold"
      style={Styles.collapseStyles([styles.numberList, {bottom: 96, left: 350, position: 'absolute'}])}
    >
      2
    </Kb.Text>
  </Kb.Box>
)

class CancelWhenEnabled extends React.PureComponent<Props> {
  _cancelOnEnabled = () =>
    this.props.driverStatus.type === Types.DriverStatusType.Enabled && this.props.onCancel()
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
          <Kb.Box style={Styles.globalStyles.flexBoxRow}>
            <Kb.Text type="BodySemibold" style={styles.numberList}>
              1
            </Kb.Text>
            <Kb.Text type="BodySemibold" style={styles.listText}>
              Click the lock icon then enter your password
            </Kb.Text>
          </Kb.Box>
          <Kb.Box style={Styles.globalStyles.flexBoxRow}>
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
    {props.driverStatus.type === Types.DriverStatusType.Disabled && props.driverStatus.isEnabling && (
      <Kb.Box style={styles.enablingContainer}>
        <Kb.Box2 direction="vertical" gap="small" fullWidth={true} fullHeight={true} centerChildren={true}>
          <Kb.ProgressIndicator white={true} />
          <Kb.Text type="BodySmall" negative={true}>
            Checking ...
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box>
    )}
  </>
)

const styles = Styles.styleSheetCreate({
  container: {
    maxWidth: 700,
    minWidth: 700,
    paddingBottom: Styles.globalMargins.mediumLarge,
    paddingLeft: Styles.globalMargins.large,
    paddingRight: Styles.globalMargins.large,
    paddingTop: Styles.globalMargins.mediumLarge,
    width: 700,
  },
  enablingContainer: {
    backgroundColor: Styles.globalColors.black_63,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  highlight: {
    backgroundColor: Styles.globalColors.black_05,
    borderColor: Styles.globalColors.blue,
    borderRadius: Styles.borderRadius,
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
  numberList: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.blue,
      borderRadius: '50%',
      color: Styles.globalColors.white,
      height: 20,
      marginRight: 13,
      minWidth: 20,
      paddingTop: 1,
      textAlign: 'center',
      width: 20,
    },
  }),
  numberListContainer: {
    paddingTop: Styles.globalMargins.large,
  },
  title: {
    maxWidth: 480,
    textAlign: 'center',
  },
})

export default Kb.HeaderOrPopup(InstallSecurityPrefs)
