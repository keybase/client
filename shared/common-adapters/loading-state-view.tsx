import * as Styles from '../styles'
import Text from './text'
import {Box2} from './box'
import ProgressBar from './progress-bar'
import ProgressIndicator from './progress-indicator'

const Kb = {
  Box2,
  ProgressBar,
  ProgressIndicator,
  Text,
}

type Props = {
  loading: boolean
  progress?: number
  white?: boolean
}

const LoadingStateView = (props: Props) =>
  props.loading ? (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      centerChildren={true}
      gap="small"
      style={styles.loadingContainer}
    >
      <Kb.Box2 direction="horizontal" gap="tiny">
        <Kb.ProgressIndicator white={props.white} />
        <Kb.Text type="BodySmall" style={props.white && {color: Styles.globalColors.white_40OrWhite_40}}>
          Loading ...
        </Kb.Text>
      </Kb.Box2>
      {props.progress !== undefined && <Kb.ProgressBar ratio={props.progress} />}
    </Kb.Box2>
  ) : null
export default LoadingStateView

const styles = Styles.styleSheetCreate(() => ({
  loadingContainer: {
    position: 'absolute',
  },
}))
