import * as Kb from '@/common-adapters'

export type Props = {
  label: string
  onClick: () => void
  disabled: boolean
}

const ContinueButton = (props: Props) => {
  const styles = useStyles()
  return (
    <Kb.Button fullWidth={true} style={styles.button} onClick={props.onClick} disabled={props.disabled}>
      <Kb.Text type="BodyBig" style={styles.continueText}>
        {props.label}
      </Kb.Text>
    </Kb.Button>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  button: {alignSelf: 'center', flexGrow: 0},
  continueText: {
    color: theme.white,
  },
}))

export default ContinueButton
