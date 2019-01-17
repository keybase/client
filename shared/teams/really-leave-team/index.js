// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import {
  Avatar,
  Box,
  ButtonBar,
  HeaderOnMobile,
  Icon,
  MaybePopup,
  ProgressIndicator,
  ScrollView,
  Text,
  WaitingButton,
} from '../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../styles'

export type Props = {
  onBack: () => void,
  onLeave: () => void,
  name: string,
  title: string,
}

const _Spinner = (props: Props) => (
  <MaybePopup onClose={props.onBack}>
    <Box
      style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, padding: globalMargins.xlarge}}
    >
      <ProgressIndicator style={{width: globalMargins.medium}} />
    </Box>
  </MaybePopup>
)
const Spinner = HeaderOnMobile(_Spinner)

const _ReallyLeaveTeam = (props: Props) => (
  <MaybePopup onClose={props.onBack}>
    <ScrollView
      contentContainerStyle={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        padding: globalMargins.large,
      }}
    >
      <Avatar teamname={props.name} size={64} />
      <Icon type="icon-team-leave-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
      <Text type="Header" style={{marginBottom: globalMargins.large, marginTop: globalMargins.large}}>
        Are you sure you want to leave {props.name}?
      </Text>
      <Text center={true} type="Body" style={{maxWidth: 430}}>
        You will lose access to all the {props.name} chats and folders, and you won't be able to get back
        unless an admin invites you.
      </Text>
      <ButtonBar direction={isMobile ? 'column' : 'row'} fullWidth={isMobile}>
        <WaitingButton
          type="Secondary"
          onClick={props.onBack}
          onlyDisable={true}
          label="Cancel"
          waitingKey={Constants.leaveTeamWaitingKey(props.name)}
        />
        <WaitingButton
          type="Danger"
          onClick={props.onLeave}
          label={`Yes, leave ${props.name}`}
          waitingKey={Constants.leaveTeamWaitingKey(props.name)}
        />
      </ButtonBar>
    </ScrollView>
  </MaybePopup>
)

export default HeaderOnMobile(_ReallyLeaveTeam)
export {Spinner}
