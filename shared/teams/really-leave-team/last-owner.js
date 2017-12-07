// @flow
import * as React from 'react'
import {Avatar, Box, Text, Icon, Button, MaybePopup, ButtonBar} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

type Props = {
  onClose: () => void,
  onLeave: () => void,
  name: string,
}

const ReallyLeaveTeam = (props: Props) => (
  <MaybePopup
    onClose={props.onClose}
    styleContainer={{height: 'auto'}}
    styleCover={{justifyContent: 'center', alignItems: 'center'}}
  >
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        padding: globalMargins.medium,
        paddingTop: globalMargins.xlarge,
        paddingBottom: globalMargins.xlarge,
      }}
    >
      <Avatar teamname={props.name} size={64} />
      <Icon type="icon-team-leave-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
      <Text
        type="Header"
        style={{
          margin: globalMargins.medium,
          marginBottom: globalMargins.small,
          width: 380,
          textAlign: 'center',
        }}
      >
        You can't leave the {props.name} team because you're the only owner.
      </Text>
      <Text
        type="Body"
        style={{
          margin: globalMargins.medium,
          marginTop: 0,
          marginBottom: globalMargins.small,
          maxWidth: 430,
          textAlign: 'center',
        }}
      >
        You'll have to add another user as an owner before you can leave {props.name}.
      </Text>
      <ButtonBar>
        <Button type="Primary" onClick={props.onClose} label="Got it" />
      </ButtonBar>
    </Box>
  </MaybePopup>
)

export default ReallyLeaveTeam
