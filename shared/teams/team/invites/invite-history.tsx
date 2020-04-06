import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import {useTeamDetailsSubscribe} from '../../subscriber'
import {ModalTitle} from '../../common'

type Props = Container.RouteProps<{teamID: Types.TeamID}>

const InviteHistory = (props: Props) => {
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  useTeamDetailsSubscribe(teamID)
  const teamMeta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = Container.useSelector(s => Constants.getTeamDetails(s, teamID))
  const loading = teamDetails.teamID === Types.noTeamID

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onClose = () => dispatch(nav.safeNavigateUpPayload())
  const onGenerate = () => {} // TODO

  return (
    <Kb.Modal
      header={{
        hideBorder: true,
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Close
          </Kb.Text>
        ) : (
          undefined
        ),
        rightButton: Styles.isMobile ? (
          undefined
        ) : (
          <Kb.Button mode="Secondary" label="Generate link" small={true} onClick={onGenerate} />
        ),
        title: <ModalTitle title="Invite links" teamID={teamID} />,
      }}
      footer={{
        content: Styles.isMobile ? (
          <Kb.Button fullWidth={true} label="Generate link" onClick={onGenerate} />
        ) : (
          <Kb.Button fullWidth={true} type="Dim" label="Close" onClick={onClose} />
        ),
        hideBorder: Styles.isMobile,
      }}
      onClose={onClose}
      allowOverflow={true}
      mode="DefaultFullHeight"
    >
      <Kb.Text type="HeaderBig">Hi</Kb.Text>
    </Kb.Modal>
  )
}

export default InviteHistory
