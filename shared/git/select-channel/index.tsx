import * as React from 'react'
import {Button, ScrollView, RadioButton, Text, Box} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'

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
    <ScrollView contentContainerStyle={{padding: globalMargins.large}}>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          flex: 1,
          paddingBottom: globalMargins.xtiny,
          paddingTop: globalMargins.xtiny,
        }}
      >
        <Text type="Header">Select a channel</Text>
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            marginBottom: globalMargins.medium,
            marginTop: globalMargins.medium,
          }}
        >
          {props.channelNames.map(name => (
            <Box
              key={name}
              style={
                (globalStyles.flexBoxRow,
                {paddingLeft: globalMargins.medium, paddingRight: globalMargins.medium})
              }
            >
              <RadioButton
                label={name}
                selected={selected === name}
                style={styleRadioButton}
                onSelect={selected => selected && setSelected(name)}
              />
            </Box>
          ))}
        </Box>
        <Button waiting={props.waiting} label="Submit" onClick={submit} small={true} />
      </Box>
    </ScrollView>
  )
}

const styleRadioButton = {
  ...globalStyles.flexBoxRow,
  marginLeft: globalMargins.tiny,
}

export default SelectChannel
