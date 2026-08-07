import * as Kb from '@/common-adapters'
import {SignupScreen} from '@/signup/common'

type Props = {
  title?: string
  heading: string
  message: string
  onBack: () => void
}

export const SimpleErrorScreen = (props: Props) => {
  const styles = useStyles()
  return (
    <SignupScreen
      buttons={[{label: 'Back', onClick: props.onBack, type: 'Default'}]}
      onBack={props.onBack}
      title={props.title}
    >
      <Kb.Text center={true} type="Header" style={styles.heading}>
        {props.heading}
      </Kb.Text>
      <Kb.Text type="Body" center={true}>
        {props.message}
      </Kb.Text>
    </SignupScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      heading: {maxWidth: 460, width: '80%'},
    }) as const
)

export default SimpleErrorScreen
