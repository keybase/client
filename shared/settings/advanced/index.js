// @flow
import * as React from 'react'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../styles'
import {Box, Button, Text, Checkbox} from '../../common-adapters'

type Props = {
  openAtLogin: boolean,
  onSetOpenAtLogin: (open: boolean) => void,
  onDBNuke: () => void,
  onBack: () => void,
}

const Advanced = (props: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      flex: 1,
      padding: globalMargins.medium,
    }}
  >
    {!isMobile && (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'left',
          flex: 1,
        }}
      >
        <Checkbox
          label="Open Keybase on startup"
          checked={props.openAtLogin}
          onCheck={props.onSetOpenAtLogin}
        />
      </Box>
    )}
    <DBNuke {...props} />
  </Box>
)

function DBNuke(props: Props) {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingTop: globalMargins.xlarge,
        paddingBottom: globalMargins.medium,
        flex: 1,
      }}
    >
      <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
        {isMobile
          ? `Please don't do anything here unless instructed to by a developer.`
          : `Please don't do anything below here unless instructed to by a developer.`}
      </Text>
      <Box style={{width: '100%', height: 2, backgroundColor: globalColors.grey}} />
      <Button
        style={{marginTop: globalMargins.small}}
        type="Danger"
        label="DB Nuke"
        onClick={props.onDBNuke}
      />
      <Box style={{flex: 1}} />
    </Box>
  )
}

export default Advanced
