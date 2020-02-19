import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import {Activity, ModalTitle} from '../../common'
import {pluralize} from '../../../util/string'

type Props = {
  teamID: Types.TeamID
  username: string
}

const AddToChannels = ({teamID, username}: Props) => {
  const meta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const channels = Container.useSelector(s => Constants.getTeamChannelInfos(s, teamID))
  const [, setFilter] = React.useState('')
  const items = [
    {type: 'header' as const},
    ...[...channels.values()].map(c => ({
      channelname: c.channelname,
      numMembers: c.numParticipants,
      type: 'channel' as const,
    })),
  ]
  const renderItem = (_, item: Unpacked<typeof items>) => {
    let content
    switch (item.type) {
      case 'header':
        return <HeaderRow />
      case 'channel':
        return (
          <ChannelRow
            channelname={item.channelname}
            numMembers={item.numMembers}
            selected={false}
            onSelect={() => {}}
          />
        )
    }
  }
  return (
    <Kb.Modal
      header={{
        hideBorder: Styles.isMobile,
        leftButton: Styles.isMobile ? <Kb.Text type="BodyBigLink">Cancel</Kb.Text> : undefined,
        title: <ModalTitle teamname={meta.teamname} title={`Add ${username} to...`} />,
      }}
      allowOverflow={true}
      noScrollView={true}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={Styles.globalStyles.flexOne}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchFilterContainer}>
          <Kb.SearchFilter
            placeholderText={`Search ${channels.size} ${pluralize('channel', channels.size)}`}
            icon="iconfont-search"
            onChange={setFilter}
            size="full-width"
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" style={styles.listContainer} fullWidth={true}>
          <Kb.List2 items={items} renderItem={renderItem} itemHeight={{height: 48, type: 'fixed'}} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const HeaderRow = ({onCreate, onSelectAll}) => (
  <Kb.Box2
    direction="horizontal"
    alignItems="center"
    fullWidth={true}
    style={Styles.collapseStyles([styles.item, styles.headerItem])}
  >
    <Kb.Button label="Create channel" small={true} mode="Secondary" />
    <Kb.Text type="BodyPrimaryLink">Select all</Kb.Text>
  </Kb.Box2>
)

const ChannelRow = ({channelname, numMembers, selected, onSelect}) => (
  <Kb.ListItem2
    onClick={onSelect}
    type="Small"
    action={<Kb.CheckCircle checked={selected} onCheck={onSelect} />}
    firstItem={true}
    body={
      <Kb.Box2 direction="vertical" alignItems="stretch">
        <Kb.Text type={Styles.isMobile ? 'Body' : 'BodySemibold'} lineClamp={1}>
          {channelname}
        </Kb.Text>
        {!Styles.isMobile && (
          <Kb.Box2 direction="horizontal" alignSelf="stretch">
            <Kb.Text type="BodySmall">
              {numMembers} {pluralize('member', numMembers)} •{' '}
            </Kb.Text>
            <Activity level="extinct" />
          </Kb.Box2>
        )}
      </Kb.Box2>
    }
    containerStyleOverride={{marginLeft: 16, marginRight: 8}}
    height={48}
  />
)
// (
//   <Kb.Box2 direction="horizontal" alignItems="center" style={styles.item} fullWidth={true}>
//     <Kb.Box2 direction="vertical" alignItems="stretch">
//       <Kb.Text type={Styles.isMobile ? 'Body' : 'BodySemibold'} lineClamp={1}>
//         {channelname}
//       </Kb.Text>
//       {!Styles.isMobile && (
//         <Kb.Box2 direction="horizontal" alignSelf="stretch">
//           <Kb.Text type="BodySmall">
//             {numMembers} {pluralize('member', numMembers)} •{' '}
//           </Kb.Text>
//           <Activity level="extinct" />
//         </Kb.Box2>
//       )}
//     </Kb.Box2>
//     <Kb.CheckCircle checked={selected} onCheck={onSelect} />
//   </Kb.Box2>
// )

const styles = Styles.styleSheetCreate(() => ({
  headerItem: {backgroundColor: Styles.globalColors.blueGrey},
  item: {height: 48, justifyContent: 'space-between', ...Styles.padding(0, Styles.globalMargins.small)},
  listContainer: Styles.platformStyles({
    isElectron: {
      height: 370, // shortcut to expand the modal
    },
    isMobile: Styles.globalStyles.flexOne,
  }),
  searchFilterContainer: Styles.platformStyles({
    isElectron: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
  }),
}))

export default AddToChannels
