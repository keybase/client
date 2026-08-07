import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useFuseClosedSourceConsent} from './hooks'
import {useSystemFileManagerIntegration} from './sfmi'

type Props = {
  mode: 'Icon' | 'Button'
  invert?: boolean
}

const SFMIPopup = (props: Props) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const {invert} = props
  const {driverEnable, driverStatus} = useSystemFileManagerIntegration()
  const {type} = driverStatus
  const isEnabling = type === T.FS.DriverStatusType.Disabled ? driverStatus.isEnabling : false
  const enableDriver = () => driverEnable()
  const {canContinue, component: fuseConsentComponent} = useFuseClosedSourceConsent(
    type === T.FS.DriverStatusType.Disabled && isEnabling,
    invert
  )

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p

    return (
      <Kb.Popup style={styles.popup} attachTo={attachTo} onHidden={hidePopup} position="bottom right">
        <Kb.ClickableBox
          direction="vertical"
          fullWidth={true}
          onClick={e => e?.stopPropagation()}
        >
          <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.fancyFinderIcon}>
            <Kb.ImageIcon type="icon-fancy-finder-132-96" />
          </Kb.Box2>
          <Kb.Text type="BodyBig" style={styles.text}>
            Enable Keybase in {C.fileUIName}?
          </Kb.Text>
          <Kb.Text type="BodySmall" style={styles.text} center={true}>
            Get access to your files and folders just like you normally do with your local files. It&apos;s
            encrypted and secure.
          </Kb.Text>
          <Kb.Divider style={styles.divider} />
          {fuseConsentComponent}
          <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.buttonBox}>
            <Kb.Button
              type="Success"
              label="Yes, enable"
              waiting={type === T.FS.DriverStatusType.Disabled && isEnabling}
              disabled={!canContinue}
              onClick={enableDriver}
            />
          </Kb.Box2>
        </Kb.ClickableBox>
      </Kb.Popup>
    )
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  if (type !== T.FS.DriverStatusType.Disabled) {
    return null
  }
  return (
    <>
      {props.mode === 'Icon' ? (
        <Kb.WithTooltip tooltip={`Show in ${C.fileUIName}`}>
          <Kb.Box2 direction="vertical" ref={popupAnchor}>
            <Kb.Icon
              type="iconfont-finder"
              padding="tiny"
              fontSize={16}
              color={theme.black_50}
              hoverColor={theme.black}
              onClick={showPopup}
            />
          </Kb.Box2>
        </Kb.WithTooltip>
      ) : (
        <Kb.Button
          mode="Secondary"
          small={true}
          label={`Enable ${C.fileUIName} integration`}
          onClick={showPopup}
          ref={popupAnchor}
        />
      )}
      {popup}
    </>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  buttonBox: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.tiny),
  },
  divider: {
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginTop: Kb.Styles.globalMargins.small,
  },
  fancyFinderIcon: {
    ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
    paddingTop: Kb.Styles.globalMargins.medium,
  },
  popup: {
    backgroundColor: theme.white,
    marginTop: Kb.Styles.globalMargins.tiny,
    overflow: 'visible',
    padding: Kb.Styles.globalMargins.small,
    width: 260,
  },
  text: {
    ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
    paddingTop: Kb.Styles.globalMargins.tiny,
  },
}))
export default SFMIPopup
