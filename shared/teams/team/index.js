// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import {Avatar, Box, Text, Tabs, List, Icon} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {isMobile} from '../../constants/platform'

export type RowProps = {
  ...Constants.MemberInfo,
}

export type Props = {
  you: string,
  name: Constants.Teamname,
  members: Array<RowProps>,
}

const typeToLabel = {
  admins: 'Admin',
  owners: 'Owner',
  readers: 'Reader',
  writers: 'Writer',
}

const showCrown = {
  admins: true,
  owners: true,
  readers: false,
  writer: false,
}

class Team extends React.PureComponent<Props> {
  _renderItem = (index: number, item: RowProps) => {
    return (
      <Box
        key={item.username}
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flexShrink: 0,
          height: isMobile ? 56 : 48,
          padding: globalMargins.tiny,
          width: '100%',
        }}
      >
        <Avatar username={item.username} size={isMobile ? 48 : 32} />
        <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
          <Text type={this.props.you === item.username ? 'BodySemiboldItalic' : 'BodySemibold'}>
            {item.username}
          </Text>
          <Box style={globalStyles.flexBoxRow}>
            {!!showCrown[item.type] &&
              <Icon
                type="iconfont-crown"
                style={{
                  color: globalColors.black_40,
                  fontSize: 12,
                  marginLeft: globalMargins.xtiny,
                  marginRight: globalMargins.xtiny,
                }}
              />}
            <Text type="Body">{typeToLabel[item.type]}</Text>
          </Box>
        </Box>
      </Box>
    )
  }

  render() {
    const {name, members} = this.props
    const tabs = [
      <Text key="members" type="BodySmallSemibold" style={{color: globalColors.black_75, padding: 10}}>
        MEMBERS ({members.length})
      </Text>,
    ]
    // TODO admin lets us have multiple tabs
    const selectedTab = tabs[0]

    return (
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1}}>
        <Avatar isTeam={true} teamname={name} size={64} />
        <Text type="Header" style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}}>
          {name}
        </Text>
        <Text type="BodySmall">TEAM</Text>
        <Tabs
          tabs={tabs}
          selected={selectedTab}
          onSelect={() => {}}
          style={{alignSelf: 'flex-start', height: globalMargins.large}}
        />
        <List items={members} fixedHeight={48} renderItem={this._renderItem} style={{alignSelf: 'stretch'}} />
      </Box>
    )
  }
}

export default Team
