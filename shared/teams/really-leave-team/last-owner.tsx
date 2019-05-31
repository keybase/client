import * as React from 'react'
import {Avatar, Box, Text, Icon, Button, HeaderOnMobile, MaybePopup, ButtonBar} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

type Props = {
  onBack: () => void
  onLeave: () => void
  name: string
  title: string
}

const _ReallyLeaveTeam = (props: Props) => (
  <MaybePopup
    onClose={props.onBack}
    styleContainer={{height: 'auto'}}
    styleCover={{alignItems: 'center', justifyContent: 'center'}}
  >
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        padding: globalMargins.medium,
        paddingBottom: globalMargins.xlarge,
        paddingTop: globalMargins.xlarge,
      }}
    >
      <Avatar teamname={props.name} size={64} />
      <Icon type="icon-team-leave-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
      <Text
        center={true}
        type="Header"
        style={{
          margin: globalMargins.medium,
          marginBottom: globalMargins.small,
          maxWidth: 380,
        }}
      >
        You can't leave the {props.name} team because you're the only owner.
      </Text>
      <Text
        type="Body"
        center={true}
        style={{
          margin: globalMargins.medium,
          marginBottom: globalMargins.small,
          marginTop: 0,
          maxWidth: 430,
        }}
      >
        You'll have to add another user as an owner before you can leave {props.name}.
      </Text>
      <ButtonBar>
        <Button onClick={props.onBack} label="Got it" />
      </ButtonBar>
    </Box>
  </MaybePopup>
)

export default HeaderOnMobile(_ReallyLeaveTeam)
