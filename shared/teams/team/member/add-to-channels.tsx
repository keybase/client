import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import {ModalTitle} from '../../common'
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
        content = <Kb.Text type="Body">What is up</Kb.Text>
        break
      case 'channel':
        content = <Kb.Text type="Body">{item.channelname}</Kb.Text>
        break
    }
    return (
      <Kb.Box2 direction="horizontal" style={{height: 48}}>
        {content}
      </Kb.Box2>
    )
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

const styles = Styles.styleSheetCreate(() => ({
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
