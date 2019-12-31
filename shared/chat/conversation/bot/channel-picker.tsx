import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as TeamTypes from '../../../constants/types/teams'
import * as TeamConstants from '../../../constants/teams'
import * as Container from '../../../util/container'

type Props = {
  installInConvs: string[]
  setChannelPickerScreen: (show: boolean) => void
  setInstallInConvs: (convs: string[]) => void
  teamname: string
}

type RowProps = {
  selected: boolean
  channelInfo: TeamTypes.ChannelInfo
}
const Row = ({selected, channelInfo}: RowProps) => (
  <Kb.Box2 direction="horizontal">
    <Kb.Checkbox
      checked={selected}
      label=""
      onCheck={() => null /* ontoggle */}
      style={{alignSelf: 'flex-start', marginRight: 0}}
      disabled={channelInfo.channelname.toLowerCase() === 'general'}
    />
    <Kb.Box2 direction="vertical">
      <Kb.Text lineClamp={1} type="BodySecondaryLink">
        #{' '}
        <Kb.Text type="Body" style={styles.channelText}>
          {channelInfo.channelname}
        </Kb.Text>
      </Kb.Text>
      <Kb.Text type="BodySecondaryLink">{channelInfo.description}</Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)
const ChannelPicker = (props: Props) => {
  // TODO: consider moving state setup somewhere else
  const channelInfos = Container.useSelector(state =>
    TeamConstants.getTeamChannelInfos(state, props.teamname)
  )

  const rows = [...channelInfos.entries()].map(([convID, channelInfo]) => (
    <Row key={convID} selected={props.installInConvs.includes(convID)} channelInfo={channelInfo} />
  ))

  return <Kb.Box2 direction="vertical">{rows}</Kb.Box2>
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      channelText: Styles.platformStyles({
        isElectron: {
          wordBreak: 'break-all',
        },
      }),
    } as const)
)

export default ChannelPicker
