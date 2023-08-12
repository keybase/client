import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import {useFuseClosedSourceConsent} from './hooks'
import * as C from '../../constants'
import {fileUIName} from '../../constants/platform'

type Props = {
  mode: 'Icon' | 'Button'
}

const SFMIPopup = (props: Props) => {
  const sfmi = C.useFSState(s => s.sfmi)
  const driverEnable = C.useFSState(s => s.dispatch.driverEnable)
  const {driverStatus} = sfmi
  const {type} = driverStatus
  const isEnabling = type === Types.DriverStatusType.Disabled ? driverStatus.isEnabling : false
  const enableDriver = React.useCallback(() => driverEnable(), [driverEnable])
  const {canContinue, component: fuseConsentComponent} = useFuseClosedSourceConsent(
    type === Types.DriverStatusType.Disabled && isEnabling,
    undefined,
    undefined
  )

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p

      return (
        <Kb.Overlay
          style={styles.popup}
          attachTo={attachTo}
          onHidden={toggleShowingPopup}
          position="bottom right"
        >
          <Kb.Box
            style={styles.container}
            onClick={(e: any) => {
              e.stopPropagation()
            }}
          >
            <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.fancyFinderIcon}>
              <Kb.Icon type="icon-fancy-finder-132-96" />
            </Kb.Box2>
            <Kb.Text type="BodyBig" style={styles.text}>
              Enable Keybase in {fileUIName}?
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
                waiting={type === Types.DriverStatusType.Disabled && isEnabling}
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
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  if (type !== Types.DriverStatusType.Disabled) {
    return null
  }
  return (
    <>
      {props.mode === 'Icon' ? (
        <Kb.WithTooltip tooltip={`Show in ${fileUIName}`}>
          <Kb.Icon
            type="iconfont-finder"
            padding="tiny"
            fontSize={16}
            color={Styles.globalColors.black_50}
            hoverColor={Styles.globalColors.black}
            onClick={toggleShowingPopup}
            ref={popupAnchor as any}
          />
        </Kb.WithTooltip>
      ) : (
        <Kb.Button
          mode="Secondary"
          small={true}
          label={`Enable ${fileUIName} integration`}
          onClick={toggleShowingPopup}
          ref={popupAnchor}
        />
      )}
      {popup}
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  buttonBox: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    width: '100%',
  },
  divider: {
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.small,
  },
  fancyFinderIcon: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.medium,
  },
  popup: {
    backgroundColor: Styles.globalColors.white,
    marginTop: Styles.globalMargins.tiny,
    overflow: 'visible',
    padding: Styles.globalMargins.small,
    width: 260,
  },
  text: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
}))
export default SFMIPopup
