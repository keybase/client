import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useFuseClosedSourceConsent} from './hooks'

type Props = {
  mode: 'Icon' | 'Button'
}

const SFMIPopup = (props: Props) => {
  const sfmi = C.useFSState(s => s.sfmi)
  const driverEnable = C.useFSState(s => s.dispatch.driverEnable)
  const {driverStatus} = sfmi
  const {type} = driverStatus
  const isEnabling = type === T.FS.DriverStatusType.Disabled ? driverStatus.isEnabling : false
  const enableDriver = React.useCallback(() => driverEnable(), [driverEnable])
  const {canContinue, component: fuseConsentComponent} = useFuseClosedSourceConsent(
    type === T.FS.DriverStatusType.Disabled && isEnabling,
    undefined,
    undefined
  )

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p

      return (
        <Kb.Overlay style={styles.popup} attachTo={attachTo} onHidden={hidePopup} position="bottom right">
          <Kb.Box
            style={styles.container}
            onClick={e => {
              e.stopPropagation()
            }}
          >
            <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.fancyFinderIcon}>
              <Kb.Icon type="icon-fancy-finder-132-96" />
            </Kb.Box2>
            <Kb.Text type="BodyBig" style={styles.text}>
              Enable Keybase in {C.fileUIName}?
            </Kb.Text>
            <Kb.Text type="BodySmall" style={styles.text} center={true}>
              Get access to your files and folders just like you normally do with your local files. It's
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
          </Kb.Box>
        </Kb.Overlay>
      )
    },
    [canContinue, isEnabling, enableDriver, fuseConsentComponent, type]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  if (type !== T.FS.DriverStatusType.Disabled) {
    return null
  }
  return (
    <>
      {props.mode === 'Icon' ? (
        <Kb.WithTooltip tooltip={`Show in ${C.fileUIName}`}>
          <Kb.Icon
            type="iconfont-finder"
            padding="tiny"
            fontSize={16}
            color={Kb.Styles.globalColors.black_50}
            hoverColor={Kb.Styles.globalColors.black}
            onClick={showPopup}
            ref={popupAnchor}
          />
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonBox: {
    paddingBottom: Kb.Styles.globalMargins.tiny,
    paddingLeft: Kb.Styles.globalMargins.small,
    paddingRight: Kb.Styles.globalMargins.small,
    paddingTop: Kb.Styles.globalMargins.small,
  },
  container: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    width: '100%',
  },
  divider: {
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginTop: Kb.Styles.globalMargins.small,
  },
  fancyFinderIcon: {
    paddingLeft: Kb.Styles.globalMargins.small,
    paddingRight: Kb.Styles.globalMargins.small,
    paddingTop: Kb.Styles.globalMargins.medium,
  },
  popup: {
    backgroundColor: Kb.Styles.globalColors.white,
    marginTop: Kb.Styles.globalMargins.tiny,
    overflow: 'visible',
    padding: Kb.Styles.globalMargins.small,
    width: 260,
  },
  text: {
    paddingLeft: Kb.Styles.globalMargins.small,
    paddingRight: Kb.Styles.globalMargins.small,
    paddingTop: Kb.Styles.globalMargins.tiny,
  },
}))
export default SFMIPopup
