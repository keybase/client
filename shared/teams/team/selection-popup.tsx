import * as React from 'react'
import * as Types from '../../constants/types/teams'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as TeamsGen from '../../actions/teams-gen'

type Props = {
  attachTo: () => React.Component<any> | null
  selectedTab: Types.TabKey
  teamID: Types.TeamID
}

const getSelectedCount = (state: Container.TypedState, props: Props) => {
  switch (props.selectedTab) {
    case 'channels':
      return state.teams.selectedChannels.get(props.teamID)?.size ?? 0
    default:
      return 0
  }
}

export default (props: Props) => {
  const selectedCount = Container.useSelector(state => getSelectedCount(state, props))
  const dispatch = Container.useDispatch()

  const onUnselect = () =>
    dispatch(
      TeamsGen.createSetChannelSelected({channel: '', clearAll: true, selected: false, teamID: props.teamID})
    )
  const onDelete = () => {}

  return selectedCount === 0 ? null : (
    <Kb.Overlay
      attachTo={props.attachTo}
      position="bottom center"
      onHidden={() => {}}
      style={styles.overlayMargin}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.container}>
        <Kb.Text type="BodySmall">
          {selectedCount} {props.selectedTab} selected.{' '}
        </Kb.Text>
        <Kb.Text type="BodySmallPrimaryLink" onClick={onUnselect}>
          Unselect
        </Kb.Text>
        <Kb.BoxGrow />
        <Kb.Button label="Delete" type="Danger" onClick={onDelete} />
      </Kb.Box2>
    </Kb.Overlay>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Styles.globalColors.white,
    padding: Styles.globalMargins.tiny,
  },
  overlayMargin: {
    marginBottom: Styles.globalMargins.small,
  },
}))
