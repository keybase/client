// @flow
import React from 'react'
import {SuccessComponent} from './index.shared'
import {Box, Text, HeaderHoc, ScrollView, InfoNote, Input, Button, ButtonBar} from '../../common-adapters/'
import {compose, withProps, branch, renderComponent} from 'recompose'
import {collapseStyles, globalColors, globalStyles, globalMargins, styleSheetCreate} from '../../styles'

import type {Props} from '.'

const EntryComponent = ({errorText, name, onNameChange, onSubmit}: Props) => (
  <ScrollView>
    <Box style={globalStyles.flexBoxColumn}>
      <Box style={styles.container}>
        <Input
          autoFocus={true}
          hideUnderline={true}
          hintText="Token or team name"
          multiline={true}
          rowsMin={5}
          value={name}
          onChangeText={onNameChange}
          onEnterKeyDown={onSubmit}
          inputStyle={collapseStyles([
            styles.input,
            {
              borderColor: errorText ? globalColors.red : globalColors.grey,
            },
          ])}
          small={true}
        />
        {!!errorText && <Text type="BodySmallError">{errorText}</Text>}
        <ButtonBar direction="column">
          <Button type="Primary" style={styles.button} onClick={onSubmit} label="Continue" />
        </ButtonBar>
        <InfoNote>
          <Text type="BodySmall" style={styles.info}>
            If you got an invitation by text, you can copy + paste the entire message here.
          </Text>
        </InfoNote>
      </Box>
    </Box>
  </ScrollView>
)

const styles = styleSheetCreate({
  button: {
    marginBottom: globalMargins.small,
    marginTop: globalMargins.small,
    width: '100%',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: globalMargins.small,
    marginRight: globalMargins.small,
    marginTop: globalMargins.small,
  },
  info: {
    maxWidth: 280,
    textAlign: 'center',
  },
  input: {
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    marginTop: globalMargins.small,
    paddingBottom: globalMargins.small,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
    paddingTop: globalMargins.small,
    width: '100%',
  },
})

export default compose(
  withProps((props: Props) => ({
    headerStyle: {borderBottomWidth: 0},
    title: 'Join a team',
  })),
  HeaderHoc,
  branch((props: Props) => props.success, renderComponent(SuccessComponent))
)(EntryComponent)
