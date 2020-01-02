import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as TeamTypes from '../../../constants/types/teams'
import * as TeamConstants from '../../../constants/teams'
import * as Container from '../../../util/container'
import * as TeamsGen from '../../../actions/teams-gen'

type Props = {
  installInConvs: string[]
  setChannelPickerScreen: (show: boolean) => void
  setInstallInConvs: (convs: string[]) => void
  teamID: TeamTypes.TeamID
}

const toggleChannel = (convID: string, installInConvs: string[]) => {
  if (installInConvs.includes(convID)) {
    return installInConvs.filter(id => id !== convID)
  } else {
    return installInConvs.concat([convID])
  }
}

type RowProps = {
  onToggle: () => void
  selected: boolean
  channelInfo: TeamTypes.ChannelInfo
}
const Row = ({onToggle, selected, channelInfo}: RowProps) => (
  <Kb.Box2 direction="horizontal" alignSelf="flex-start" style={{marginBottom: Styles.globalMargins.tiny}}>
    <Kb.Checkbox checked={selected} label="" onCheck={onToggle} style={styles.channelCheckbox} />
    <Kb.Text lineClamp={1} type="Body" style={styles.channelHash}>
      #
    </Kb.Text>
    <Kb.Box2 direction="vertical">
      <Kb.Text type="Body" style={styles.channelText}>
        {channelInfo.channelname}
      </Kb.Text>
      <Kb.Text type="Body" style={{color: Styles.globalColors.black_50}}>
        {channelInfo.description}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)
const ChannelPicker = (props: Props) => {
  // TODO: consider moving state setup somewhere else
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    if (!props.teamID) {
      return
    }

    dispatch(TeamsGen.createGetChannels({teamID: props.teamID}))
  }, [props.teamID])
  const channelInfos = Container.useSelector(state => TeamConstants.getTeamChannelInfos(state, props.teamID))

  const rows = [...channelInfos.entries()].map(([convID, channelInfo]) => (
    <Row
      key={convID}
      onToggle={() => props.setInstallInConvs(toggleChannel(convID, props.installInConvs))}
      selected={props.installInConvs.includes(convID)}
      channelInfo={channelInfo}
    />
  ))

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {rows}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      channelCheckbox: {
        marginRight: Styles.globalMargins.tiny,
      },
      channelHash: {
        color: Styles.globalColors.black_50,
        flexShrink: 0,
        marginRight: Styles.globalMargins.xtiny,
      },
      channelText: Styles.platformStyles({
        isElectron: {
          wordBreak: 'break-all',
        },
      }),
    } as const)
)

export default ChannelPicker
