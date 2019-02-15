// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import Header from './header'
import Banner from './banner'
import BetaNote from './beta-note'
import {memoize} from '../../util/memoize'

import type {Props as HeaderProps} from './header'
import type {Props as BannerProps} from './banner'
import type {Props as BetaNoteProps} from './beta-note'

// TODO: Don't make all these props just so we can pass it down. Make these their own connected components
type Props = {|
  ...$Exact<HeaderProps>,
  ...$Exact<BetaNoteProps>,
  ...$Exact<BannerProps>,
  ...{|sawChatBanner: boolean, title: string, onBack: () => void|},
|}

type RowProps = {
  firstItem: boolean,
  name: string,
  membercount: number,
  isNew: boolean,
  isOpen: boolean,
  newRequests: number,
  onOpenFolder: ?() => void,
  onManageChat: ?() => void,
  resetUserCount?: number,
  onViewTeam: () => void,
}

export const TeamRow = (props: RowProps) => {
  const badgeCount = props.newRequests + props.resetUserCount

  return (
    <Kb.ListItem2
      firstItem={props.firstItem}
      onClick={props.onViewTeam}
      icon={
        <Kb.Box2 direction="vertical" style={styles.avatarContainer}>
          <Kb.Avatar size={Styles.isMobile ? 48 : 32} teamname={props.name} isTeam={true} />
          {!!badgeCount && <Kb.Badge badgeNumber={badgeCount} badgeStyle={styles.badge} />}
        </Kb.Box2>
      }
      body={
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start">
            <Kb.Text type="BodySemibold">{props.name}</Kb.Text>
            {props.isOpen && <Kb.Meta title="open" backgroundColor={Styles.globalColors.green} />}
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start">
            {props.isNew && <Kb.Meta title="new" backgroundColor={Styles.globalColors.orange} />}
            <Kb.Text type="BodySmall">
              {props.membercount + ' member' + (props.membercount !== 1 ? 's' : '')}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      }
      action={
        <Kb.Box2 direction="horizontal" gap="small">
          {!Styles.isMobile && props.onOpenFolder && (
            <Kb.Icon type="iconfont-folder-private" onClick={props.onOpenFolder} />
          )}
          {!Styles.isMobile && props.onManageChat && (
            <Kb.Icon type="iconfont-chat" onClick={props.onManageChat} />
          )}
        </Kb.Box2>
      }
    />
  )
}

class Teams extends React.PureComponent<Props> {
  _teamsAndExtras = memoize(teamnames => {
    return [
      {key: '_banner', type: '_banner'},
      ...teamnames.map(t => ({key: t, team: t, type: 'team'})),
      {key: '_note', type: '_note'},
    ]
  })

  _onOpenFolder = name => this.props.onOpenFolder(name)
  _onManageChat = name => this.props.onManageChat(name)
  _onViewTeam = name => this.props.onViewTeam(name)

  _renderItem = (index, item) => {
    switch (item.type) {
      case '_banner':
        return this.props.sawChatBanner ? null : (
          <Banner onReadMore={this.props.onReadMore} onHideChatBanner={this.props.onHideChatBanner} />
        )
      case '_note':
        return <BetaNote onReadMore={this.props.onReadMore} />
      case 'team':
        const name = item.team
        return (
          <TeamRow
            firstItem={index === 1}
            key={name}
            name={name}
            isNew={this.props.newTeams.includes(name)}
            isOpen={this.props.teamNameToIsOpen[name]}
            newRequests={this.props.newTeamRequests.some(team => team === name)}
            membercount={this.props.teammembercounts[name]}
            onOpenFolder={() => this._onOpenFolder(name)}
            onManageChat={() => this._onManageChat(name)}
            onViewTeam={() => this._onViewTeam(name)}
            resetUserCount={this.props.teamresetusers[name] ? this.props.teamresetusers[name].size : 0}
          />
        )
      default:
        return null
    }
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Header
          loaded={this.props.loaded}
          onCreateTeam={this.props.onCreateTeam}
          onJoinTeam={this.props.onJoinTeam}
        />
        {!this.props.loaded && <Kb.ProgressIndicator style={styles.progress} />}
        <Kb.List items={this._teamsAndExtras(this.props.teamnames)} renderItem={this._renderItem} />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  avatarContainer: {position: 'relative'},
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
  },
  progress: {
    alignSelf: 'center',
    marginBottom: Styles.globalMargins.small,
    width: 20,
  },
})

export default Teams
