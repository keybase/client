import * as Kb from '@/common-adapters'
import {InfoNoteRow, useInfoNoteStyles} from '../common'

const SubteamInfoRow = () => {
  const infoNoteStyles = useInfoNoteStyles()
  return (
    <InfoNoteRow>
      <Kb.Text type="BodySmall" center={true} style={infoNoteStyles.text}>
        Use subteams to create private groups within your team or to invite outside collaborators.
      </Kb.Text>
    </InfoNoteRow>
  )
}
export default SubteamInfoRow
