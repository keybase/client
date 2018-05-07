// @flow
import * as React from 'react'
import {Avatar, Box, Text, Icon, Button, HeaderHoc, MaybePopup, ButtonBar} from '../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../styles'

type Props = {
  onBack: () => void,
  onLeave: () => void,
  name: string,
  title: string,
}

const _ReallyLeaveTeam = (props: Props) => (
  <MaybePopup
    onClose={props.onBack}
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
          maxWidth: 380,
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
        <Button type="Primary" onClick={props.onBack} label="Got it" />
      </ButtonBar>
    </Box>
  </MaybePopup>
)
const ReallyLeaveTeam = isMobile ? HeaderHoc(_ReallyLeaveTeam) : _ReallyLeaveTeam

export default ReallyLeaveTeam
