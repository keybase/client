import * as Kb from '@/common-adapters'
import {InfoNoteRow, infoNoteStyles} from '../common'

const SubteamInfoRow = () => (
  <InfoNoteRow>
    <Kb.Text type="BodySmall" center={true} style={infoNoteStyles.text}>
      Use subteams to create private groups within your team or to invite outside collaborators.
    </Kb.Text>
  </InfoNoteRow>
)
export default SubteamInfoRow
