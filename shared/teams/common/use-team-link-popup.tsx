import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'

export const useTeamLinkPopup = (teamname: string) => {
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      const shareURLApp = `keybase://team-page/${teamname}`
      const shareURLWeb = `https://keybase.io/team/${teamname}`
      const content = (
        <Kb.Box2 direction="vertical" style={styles.linkPopupContainer} gap="small" fullWidth={true}>
          <Kb.Text type="Header">Share a link to this team</Kb.Text>
          <Kb.Box2 direction="vertical" gap="tiny" alignSelf="stretch" alignItems="stretch">
            <Kb.Text type="Body">In the Keybase app:</Kb.Text>
            <Kb.CopyText text={shareURLApp} shareSheet={true} />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" gap="tiny" alignSelf="stretch" alignItems="stretch">
            <Kb.Text type="Body">On the web:</Kb.Text>
            <Kb.CopyText text={shareURLWeb} shareSheet={true} />
          </Kb.Box2>
          {Styles.isMobile && (
            <Kb.Button type="Dim" label="Close" fullWidth={true} onClick={toggleShowingPopup} />
          )}
        </Kb.Box2>
      )
      if (Styles.isMobile) {
        return <Kb.MobilePopup>{content}</Kb.MobilePopup>
      }
      return (
        <Kb.Overlay
          position="bottom left"
          style={styles.overlay}
          attachTo={attachTo}
          onHidden={toggleShowingPopup}
        >
          {content}
        </Kb.Overlay>
      )
    },
    [teamname]
  )

  return Kb.usePopup2(makePopup)
}

const styles = Styles.styleSheetCreate(() => ({
  linkPopupContainer: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
    },
    isElectron: {maxWidth: 300},
  }),
  overlay: {backgroundColor: Styles.globalColors.white, marginTop: Styles.globalMargins.tiny},
}))

export default useTeamLinkPopup
