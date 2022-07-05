import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'

type Props = Container.RouteProps<{
  isOpenTeam: boolean
  teamname: string
  onCancel: () => void
  onConfirm: () => void
}>

const Wrapper = ({children, onBack}: {children: React.ReactNode; onBack: () => void}) =>
  Styles.isMobile ? (
    <Kb.ScrollView
      style={{...Styles.globalStyles.fillAbsolute, ...Styles.globalStyles.flexBoxColumn}}
      contentContainerStyle={styles.scrollContainer}
      children={children}
    />
  ) : (
    <Kb.PopupDialog onClose={onBack} children={children} />
  )

const OpenTeamWarning = (props: Props) => {
  const [enabled, setEnabled] = React.useState(false)
  const isOpenTeam = Container.getRouteProps(props, 'isOpenTeam', false)
  const teamname = Container.getRouteProps(props, 'teamname', '')
  const onConfirmCallback = Container.getRouteProps(props, 'onConfirm', () => undefined)

  const dispatch = Container.useDispatch()

  const onConfirm = () => {
    dispatch(RouteTreeGen.createClearModals())
    onConfirmCallback()
  }

  const onCancel = () => dispatch(RouteTreeGen.createClearModals())

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
            label={Styles.isMobile ? 'Confirm' : `Yes, set to ${isOpenTeam ? 'Open' : 'Private'}`}
            disabled={!enabled}
          />
        </Kb.ButtonBar>
      </Kb.Box>
    </Wrapper>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  bodyStyle: {marginBottom: Styles.globalMargins.small},
  checkboxStyle: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.xlarge,
    },
    isMobile: {
      marginBottom: Styles.globalMargins.small,
    },
  }),
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      paddingBottom: Styles.globalMargins.large,
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.xlarge,
      paddingRight: Styles.globalMargins.xlarge,
      paddingTop: Styles.globalMargins.xlarge,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
    },
  }),
  headerStyle: {marginBottom: Styles.globalMargins.small},
  iconStyle: {marginBottom: 20},
  label: {flexShrink: 1},
  scrollContainer: {
    ...Styles.globalStyles.flexBoxCenter,
    flex: 1,
  },
}))

export default OpenTeamWarning
