import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import {ModalTitle} from '../../common'

type Props = {
  teamID: Types.TeamID
  username: string
}

const AddToChannels = ({teamID, username}: Props) => {
  const meta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const [filter, setFilter] = React.useState('')
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
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchFilterContainer}>
          <Kb.SearchFilter
            placeholderText={`Search 20 channels`}
            icon="iconfont-search"
            onChange={setFilter}
            size="full-width"
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  searchFilterContainer: Styles.platformStyles({
    isElectron: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
  }),
}))

export default AddToChannels
