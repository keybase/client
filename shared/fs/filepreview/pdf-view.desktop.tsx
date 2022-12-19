import * as Kb from '../../common-adapters'
import type {Props} from './pdf-view'

const PDFView = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <embed src={props.url} width="100%" height="100%" />
    </Kb.Box2>
  )
}
export default PDFView
