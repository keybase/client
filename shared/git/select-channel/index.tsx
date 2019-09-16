import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  channelNames: Array<string>
  onBack?: () => void
  onCancel: () => void
  onLoad: () => void
  onSubmit: (channelName: string) => void
  selected: string
  waiting: boolean
}

const SelectChannel = (props: Props) => {
  const {onSubmit, onCancel} = props
  React.useEffect(() => {
    props.onLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [selected, setSelected] = React.useState(props.selected)

  const submit = () => {
    onSubmit(selected)
    onCancel()
  }

  return (
    <Kb.ScrollView contentContainerStyle={{padding: Styles.globalMargins.large}}>
      <Kb.Box
        style={{
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          flex: 1,
          paddingBottom: Styles.globalMargins.xtiny,
          paddingTop: Styles.globalMargins.xtiny,
        }}
      >
        <Kb.Text type="Header">Select a channel</Kb.Text>
        <Kb.Box
          style={{
            ...Styles.globalStyles.flexBoxColumn,
            marginBottom: Styles.globalMargins.medium,
            marginTop: Styles.globalMargins.medium,
          }}
        >
          {props.channelNames.map(name => (
            <Kb.Box
              key={name}
              style={
                (Styles.globalStyles.flexBoxRow,
                {paddingLeft: Styles.globalMargins.medium, paddingRight: Styles.globalMargins.medium})
              }
            >
              <Kb.RadioButton
                label={name}
                selected={selected === name}
                style={styles.radioButton}
                onSelect={selected => selected && setSelected(name)}
              />
            </Kb.Box>
          ))}
        </Kb.Box>
        <Kb.Button waiting={props.waiting} label="Submit" onClick={submit} small={true} />
      </Kb.Box>
    </Kb.ScrollView>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  radioButton: {
    ...Styles.globalStyles.flexBoxRow,
    marginLeft: Styles.globalMargins.tiny,
  },
}))

export default SelectChannel
