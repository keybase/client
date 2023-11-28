import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {useSettingsState} from '../use-settings'

type Props = {
  isOpenTeam: boolean
  teamname: string
}

const Wrapper = ({children, onBack}: {children: React.ReactNode; onBack: () => void}) =>
  Kb.Styles.isMobile ? (
    <Kb.ScrollView
      style={{...Kb.Styles.globalStyles.fillAbsolute, ...Kb.Styles.globalStyles.flexBoxColumn}}
      contentContainerStyle={styles.scrollContainer}
      children={children}
    />
  ) : (
    <Kb.PopupDialog onClose={onBack} children={children} />
  )

const OpenTeamWarning = (props: Props) => {
  const isOpenTeam = props.isOpenTeam
  const teamname = props.teamname
  const [enabled, setEnabled] = React.useState(false)
  const onConfirmCallback = useSettingsState(s => s.dispatch.triggerAllowOpen)

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onConfirm = () => {
    clearModals()
    onConfirmCallback()
  }

  const onCancel = () => clearModals()

  return (
    <Wrapper onBack={onCancel}>
      <Kb.Box style={styles.container}>
        <Kb.Icon type={'icon-illustration-teams-216'} style={styles.iconStyle} />
        <Kb.Text center={true} type="Header" style={styles.headerStyle}>
          Make {teamname} into {isOpenTeam ? 'an open' : 'a closed'} team?
        </Kb.Text>
        <Kb.Text center={true} type="Body" style={styles.bodyStyle}>
          You are about to make this team{' '}
          {isOpenTeam ? 'publicly visible. Anyone will be able to join this team.' : 'private.'}
        </Kb.Text>
        <Kb.Checkbox
          checked={enabled}
          onCheck={setEnabled}
          style={styles.checkboxStyle}
          label=""
          labelComponent={
            <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.label}>
              <Kb.Text type="Body">
                I understand that{' '}
                {isOpenTeam
                  ? 'anyone will be able to join this team.'
                  : 'members will only be able to join through adds or invites.'}
              </Kb.Text>
              <Kb.Text type="BodySmall">Subteams will not be affected.</Kb.Text>
            </Kb.Box2>
          }
        />
        <Kb.ButtonBar>
          <Kb.Button type="Dim" onClick={onCancel} label="Cancel" />
          <Kb.Button
            type="Danger"
            onClick={onConfirm}
            label={Kb.Styles.isMobile ? 'Confirm' : `Yes, set to ${isOpenTeam ? 'Open' : 'Private'}`}
            disabled={!enabled}
          />
        </Kb.ButtonBar>
      </Kb.Box>
    </Wrapper>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  bodyStyle: {marginBottom: Kb.Styles.globalMargins.small},
  checkboxStyle: Kb.Styles.platformStyles({
    isElectron: {
      marginBottom: Kb.Styles.globalMargins.xlarge,
    },
    isMobile: {
      marginBottom: Kb.Styles.globalMargins.small,
    },
  }),
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      paddingBottom: Kb.Styles.globalMargins.large,
    },
    isElectron: {
      paddingLeft: Kb.Styles.globalMargins.xlarge,
      paddingRight: Kb.Styles.globalMargins.xlarge,
      paddingTop: Kb.Styles.globalMargins.xlarge,
    },
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
      paddingTop: Kb.Styles.globalMargins.small,
    },
  }),
  headerStyle: {marginBottom: Kb.Styles.globalMargins.small},
  iconStyle: {marginBottom: 20},
  label: {flexShrink: 1},
  scrollContainer: {
    ...Kb.Styles.globalStyles.flexBoxCenter,
    flex: 1,
  },
}))

export default OpenTeamWarning
