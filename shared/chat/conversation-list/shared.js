// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {TeamsDivider} from '../inbox/row/teams-divider'
import {isMobile} from '../../constants/platform'

type SmallTeamRowItem = {
  type: 'small-team',
  onSelect: () => void,
  name: string,
}

type GroupRowItem = {
  type: 'group',
  onSelect: () => void,
  name: string,
  avatarUsernames: Array<string>,
}

type MoreRowItem = {
  type: 'more',
}

type BigTeamRowItem = {
  type: 'big-team',
  name: string,
}

type ChannelRowItem = {
  type: 'channel',
  onSelect: () => void,
  name: string,
}

type RowItem = SmallTeamRowItem | GroupRowItem | MoreRowItem | ChannelRowItem | BigTeamRowItem

export type Props = {
  rows: Array<RowItem>,
  hiddenCount: number,
  toggleExpand: () => void,
}

const lineClamp = isMobile ? 1 : undefined

export const SmallTeamRow = (props: SmallTeamRowItem | GroupRowItem) => (
  <Kb.ClickableBox onClick={props.onSelect}>
    <Kb.Box2
      direction="horizontal"
      gap={isMobile ? 'small' : 'tiny'}
      fullWidth={true}
      style={styles.smallTeamRow}
    >
      {props.type === 'small-team' ? (
        <Kb.Avatar size={32} teamname={props.name} isTeam={true} />
      ) : (
        // TODO: use Kb.Avatars
        <Kb.Avatar size={32} username={props.avatarUsernames[0]} />
      )}
      <Kb.Text
        type="BodySemibold"
        style={Styles.collapseStyles([styles.text, styles.blue])}
        lineClamp={lineClamp}
      >
        {props.name}
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

export const Divider = ({hiddenCount, toggle}: {hiddenCount: number, toggle: () => void}) => (
  <TeamsDivider
    key="divider"
    toggle={toggle}
    showButton={true}
    hiddenCount={hiddenCount}
    style={styles.teamDivider}
    badgeCount={0}
  />
)

export const BigTeamRow = (props: BigTeamRowItem) => (
  <Kb.Box2 direction="horizontal" gap="tiny" style={styles.bigTeamRow} fullWidth={true}>
    <Kb.Avatar size={16} teamname={props.name} isTeam={true} />
    <Kb.Text
      type="BodySmallSemibold"
      style={Styles.collapseStyles([styles.text, styles.blue])}
      lineClamp={lineClamp}
    >
      {props.name}
    </Kb.Text>
  </Kb.Box2>
)

export const ChannelRow = (props: ChannelRowItem) => (
  <Kb.ClickableBox onClick={props.onSelect}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.channelRow}>
      <Kb.Text type="Body" style={styles.text} lineClamp={lineClamp}>
        #{props.name}
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

export const heights = {
  'big-team': isMobile ? 32 : 16,
  channel: isMobile ? 48 : 25,
  estimate: 48,
  group: isMobile ? 56 : 48,
  more: isMobile ? 56 : 48,
  'small-team': isMobile ? 56 : 48,
}

const styles = Styles.styleSheetCreate({
  bigTeamRow: Styles.platformStyles({
    common: {
      height: heights['big-team'],
      paddingLeft: Styles.globalMargins.tiny,
    },
    isMobile: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.blue5,
      borderTopColor: Styles.globalColors.black_05,
      borderTopWidth: 1,
    },
  }),
  blue: {color: Styles.globalColors.blue},
  channelRow: {
    alignItems: 'center',
    height: heights.channel,
    paddingLeft: Styles.globalMargins.large,
  },
  smallTeamRow: {
    alignItems: 'center',
    height: heights['small-team'],
    padding: Styles.globalMargins.tiny,
  },
  teamDivider: {
    height: heights.more,
    justifyContent: 'flex-end',
  },
  text: Styles.platformStyles({
    common: {
      overflow: 'hidden',
    },
    isElectron: {
      textOverflow: 'ellipsis',
    },
    isMobile: {
      flexShrink: 1,
    },
  }),
})
