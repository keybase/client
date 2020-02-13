import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'

type Props = {
  channels: Array<string>
  onAddChannel: (channelname: string) => void
  onRemoveChannel: (channelname: string) => void
  teamID: Types.TeamID
}

// always shows #general
const ChannelsWidget = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" gap="tiny" style={styles.container}>
      <ChannelInputDesktop teamID={props.teamID} />
      <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.pillContainer}>
        <ChannelPill channelname="general" />
        {props.channels.map(channelname => (
          <ChannelPill
            key={channelname}
            channelname={channelname}
            onRemove={() => props.onRemoveChannel(channelname)}
          />
        ))}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const ChannelInputDesktop = ({teamID}: {teamID: Types.TeamID}) => {
  const [filter, setFilter] = React.useState('')
  const channels = Container.useSelector(s => Constants.getTeamChannelInfos(s, teamID))

  const {popup, popupAnchor, setShowingPopup, showingPopup} = Kb.usePopup(getAttachmentRef => (
    <Kb.Overlay
      attachTo={getAttachmentRef}
      visible={showingPopup}
      onHidden={() => setShowingPopup(false)}
      matchDimension={true}
      position="top center"
      positionFallbacks={['bottom center']}
    >
      <Kb.Text type="Body">Hi!</Kb.Text>
    </Kb.Overlay>
  ))

  return (
    <>
      <Kb.SearchFilter
        ref={popupAnchor}
        onFocus={() => setShowingPopup(true)}
        onBlur={() => setShowingPopup(false)}
        placeholderText="Add channels"
        icon="iconfont-search"
        onChange={() => {}}
        size={Styles.isMobile ? 'full-width' : 'small'}
      />
      {popup}
    </>
  )
}

const ChannelPill = ({channelname, onRemove}: {channelname: string; onRemove?: () => void}) => (
  <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.pill}>
    <Kb.Text type={Styles.isMobile ? 'Body' : 'BodySemibold'}>#{channelname}</Kb.Text>
    {onRemove && <Kb.Icon type="iconfont-remove" onClick={onRemove} color={Styles.globalColors.black_20} />}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.tiny),
    backgroundColor: Styles.globalColors.blueGrey,
    borderRadius: Styles.borderRadius,
  },
  pill: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.tiny),
      backgroundColor: Styles.globalColors.white,
      borderRadius: Styles.borderRadius,
      marginBottom: Styles.globalMargins.xtiny,
    },
    isMobile: {
      borderColor: Styles.globalColors.black_20,
      borderStyle: 'solid',
      borderWidth: 1,
    },
  }),
  pillContainer: {
    flexWrap: 'wrap',
  },
}))

export default ChannelsWidget
