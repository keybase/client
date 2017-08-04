// @flow
import React from 'react'
import {Box, Icon, Text} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'
import {globalStyles, globalColors} from '../styles'
import SmallRow from '../chat/inbox/row'
import * as I from 'immutable'
import SplitPane from 'react-split-pane'

const snippets = [
  'elisa: Hopefully not',
  'in the top-drawer I believe',
  'I don\t know that I would want',
  'else echo "bar";',
  'Exactly :smile:',
  'Oh it might be due to the PR',
  'akdsfjlkdjkl',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
]

const commonSmall = {
  backgroundColor: globalColors.white,
  conversationIDKey: '',
  hasUnread: false,
  isMuted: false,
  isSelected: false,
  marginRight: 0,
  onSelectConversation: () => action('onSelectConversation'),
  participantNeedToRekey: false,
  participants: I.List(['chris', 'cecileb', 'chrisnojima']),
  rekeyInfo: null,
  showBold: false,
  snippet: 'hi',
  subColor: globalColors.black_40,
  timestamp: 'some time',
  unreadCount: 0,
  usernameColor: globalColors.darkBlue,
  youNeedToRekey: false,
}
const smallTeams = [
  {
    ...commonSmall,
    conversationIDKey: '1',
    hasUnread: true,
    participants: I.List(['forgreenmoms']),
    showBold: true,
  },
  {...commonSmall, conversationIDKey: '2', hasUnread: true, participants: I.List(['chris']), showBold: true},
  {...commonSmall, conversationIDKey: '3', participants: I.List(['jzila'])},
  {...commonSmall, conversationIDKey: '4'},
  {...commonSmall, conversationIDKey: '5'},
  {...commonSmall, conversationIDKey: '6'},
  {...commonSmall, conversationIDKey: '7'},
  {...commonSmall, conversationIDKey: '8'},
  {...commonSmall, conversationIDKey: '9'},
  {...commonSmall, conversationIDKey: '10'},
  {...commonSmall, conversationIDKey: '11'},
]

// Just a simple version of the team inbox row
const commonBig = {
  channels: [
    {
      isMuted: true,
      name: '#general',
    },
    {
      hasUnread: true,
      name: '#random',
      showBold: true,
    },
    {
      name: '#zzz',
      showBold: true,
    },
  ],
  icon: '',
  name: '',
}

const bigTeams = [
  {...commonBig, icon: 'iconfont-keybase', name: 'stripe.usa'},
  {...commonBig, icon: 'iconfont-identity-facebook', name: 'stripe.eu'},
  {...commonBig, icon: 'iconfont-identity-github', name: 'techtonica'},
  {...commonBig, icon: 'iconfont-identity-hn', name: 'hackernews'},
  {...commonBig, icon: 'iconfont-identity-pgp', name: 'pgppgp'},
  {...commonBig, icon: 'iconfont-identity-reddit', name: 'a.b.c.reddit'},
]

const BigRow = (props: any) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      paddingBottom: 8,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 8,
      width: '100%',
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, width: '100%'}}>
      <Icon
        type={props.icon}
        style={{
          backgroundColor: globalColors.blue,
          color: globalColors.black,
          marginRight: 10,
        }}
      />
      <Text type="BodySmallSemibold" style={{color: globalColors.darkBlue2}}>{props.name}</Text>
    </Box>
    {props.channels.map(c => (
      <Box
        key={c.name}
        style={{
          ...globalStyles.flexBoxRow,
          paddingBottom: 8,
          paddingLeft: 40,
          paddingTop: 8,
          width: '100%',
        }}
      >
        <Text
          type={c.showBold ? 'BodySmallSemibold' : 'BodySmall'}
          style={{color: c.showBold ? globalColors.black : globalColors.black_40, fontSize: 14}}
        >
          {c.name}
        </Text>
        {c.isMuted && <Icon type="icon-shh-16" />}
      </Box>
    ))}
  </Box>
)

const smallWindow = 5
class SingleListExpand extends React.Component {
  state = {
    expandBig: true,
    expandSmall: false,
  }
  render() {
    return (
      <Box
        style={{
          border: 'solid 1px black',
          height: '100%',
          margin: 10,
          width: 240,
        }}
      >
        <Box
          style={{
            height: '100%',
            overflowY: 'auto',
            width: '100%',
          }}
        >
          {smallTeams
            .filter((_, idx) => idx < smallWindow)
            .map((t, idx) => (
              <SmallRow key={t.conversationIDKey} {...t} snippet={snippets[idx % snippets.length]} />
            ))}
          <Box style={{...globalStyles.flexBoxCenter, width: '100%', backgroundColor: 'lightBlue'}}>
            <Text
              type="BodySmall"
              style={{color: globalColors.black_60}}
              onClick={() => this.setState({expandSmall: !this.state.expandSmall})}
            >
              {'<'}
              {this.state.expandSmall
                ? `Hide oldest ${smallTeams.length - smallWindow}`
                : `Show ${smallTeams.length - smallWindow} more`}
              {'>'}
            </Text>
          </Box>
          {smallTeams
            .filter((_, idx) => idx >= smallWindow && this.state.expandSmall)
            .map((t, idx) => (
              <SmallRow key={t.conversationIDKey} {...t} snippet={snippets[idx % snippets.length]} />
            ))}
          {this.state.expandBig && bigTeams.map((t, idx) => <BigRow key={t.name} {...t} />)}
        </Box>
      </Box>
    )
  }
}

class CollapseSections extends React.Component {
  state = {
    expandBig: true,
    expandSmall: true,
  }
  render() {
    return (
      <Box
        style={{
          border: 'solid 1px black',
          height: '100%',
          margin: 10,
          width: 240,
        }}
      >
        <Box
          style={{
            height: '100%',
            overflowY: 'auto',
            width: '100%',
          }}
        >
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', backgroundColor: 'lightBlue'}}>
            <Text
              type="BodySmallSemibold"
              style={{color: globalColors.black_60, marginLeft: 10}}
              onClick={() => this.setState({expandSmall: !this.state.expandSmall})}
            >
              Small teams
            </Text>
            <Icon type={this.state.expandSmall ? 'iconfont-caret-down' : 'iconfont-caret-right'} />
          </Box>
          {this.state.expandSmall &&
            smallTeams.map((t, idx) => (
              <SmallRow key={t.conversationIDKey} {...t} snippet={snippets[idx % snippets.length]} />
            ))}
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', backgroundColor: 'lightBlue'}}>
            <Text
              type="BodySmallSemibold"
              style={{color: globalColors.black_60, marginLeft: 10}}
              onClick={() => this.setState({expandBig: !this.state.expandBig})}
            >
              Big teams
            </Text>
            <Icon type={this.state.expandSmall ? 'iconfont-caret-down' : 'iconfont-caret-right'} />
          </Box>
          {this.state.expandBig && bigTeams.map((t, idx) => <BigRow key={t.name} {...t} />)}
        </Box>
      </Box>
    )
  }
}

const load = () => {
  storiesOf('Experiments', module).add('Inbox', () => (
    <Box style={{...globalStyles.flexBoxRow, height: 500}}>
      <Box
        style={{
          border: 'solid 1px black',
          height: '100%',
          margin: 10,
          width: 240,
        }}
      >
        <Box
          style={{
            height: '100%',
            overflowY: 'auto',
            width: '100%',
          }}
        >
          {smallTeams.map((t, idx) => (
            <SmallRow key={t.conversationIDKey} {...t} snippet={snippets[idx % snippets.length]} />
          ))}
          {bigTeams.map((t, idx) => <BigRow key={t.name} {...t} />)}
        </Box>
      </Box>
      <Box
        style={{
          border: 'solid 1px black',
          height: 500,
          margin: 10,
          position: 'relative',
          width: 240,
        }}
      >
        <SplitPane
          split="horizontal"
          minSize={48 * 3}
          resizerStyle={{
            backgroundColor: globalColors.lightGrey,
            cursor: 'ns-resize',
            minHeight: 5,
            zIndex: 1,
          }}
          pane2Style={{
            minHeight: 0,
          }}
        >
          <Box
            style={{
              height: '100%',
              overflowY: 'auto',
              width: '100%',
            }}
          >
            {smallTeams.map((t, idx) => (
              <SmallRow key={t.conversationIDKey} {...t} snippet={snippets[idx % snippets.length]} />
            ))}
          </Box>
          <Box
            style={{
              height: '100%',
              overflowY: 'auto',
              width: '100%',
            }}
          >
            {bigTeams.map((t, idx) => <BigRow key={t.name} {...t} />)}
          </Box>
        </SplitPane>
      </Box>
      <SingleListExpand />
      <CollapseSections />
    </Box>
  ))
}

export default load
