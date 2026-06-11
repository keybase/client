import * as Kb from '@/common-adapters'
import {InfoNoteRow, infoNoteStyles} from '../common'

const sentence1 = 'Channels can be joined by anyone, unlike subteams.'
const sentence2 = 'Anyone except readers can create channels.'
const ChannelInfoRow = () => (
  <InfoNoteRow>
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text type="BodySmall" center={true} style={infoNoteStyles.text}>
        {sentence1} {isMobile && sentence2}
      </Kb.Text>
      {!isMobile && (
        <Kb.Text type="BodySmall" center={true} style={infoNoteStyles.text}>
          {sentence2}
        </Kb.Text>
      )}
    </Kb.Box2>
  </InfoNoteRow>
)
export default ChannelInfoRow
