import React from 'react'
import {SuccessComponent} from './index.shared'
import {
  Box2,
  Text,
  HeaderHoc,
  PlainInput,
  ScrollView,
  InfoNote,
  Button,
  ButtonBar,
} from '../../common-adapters/'
import {compose, withProps, branch, renderComponent} from 'recompose'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate} from '../../styles'

import {Props} from '.'

const EntryComponent = ({errorText, name, onNameChange, onSubmit}: Props) => (
  <ScrollView>
    <Box2 direction="horizontal" fullWidth={true} gap="small" gapEnd={true} gapStart={true}>
      <Box2 direction="vertical" style={styles.container}>
        <PlainInput
          autoFocus={true}
          placeholder="Token or team name"
          multiline={true}
          rowsMin={5}
          value={name}
          onChangeText={onNameChange}
          onEnterKeyDown={onSubmit}
          style={collapseStyles([
            styles.input,
            {
              borderColor: errorText ? globalColors.red : globalColors.greyDark,
            },
          ])}
        />
        {!!errorText && (
          <Text type="BodySmallError" style={styles.errorText}>
            {errorText}
          </Text>
        )}
        <ButtonBar direction="column">
          <Button style={styles.button} onClick={onSubmit} label="Continue" />
        </ButtonBar>
        <InfoNote>
          <Text center={true} type="BodySmall" style={styles.info}>
            If you got an invitation by text, you can copy + paste the entire message here.
          </Text>
        </InfoNote>
      </Box2>
    </Box2>
  </ScrollView>
)

const styles = styleSheetCreate({
  button: {
    marginBottom: globalMargins.small,
    marginTop: globalMargins.small,
    width: '100%',
  },
  container: {flexGrow: 1},
  errorText: {marginTop: globalMargins.tiny},
  info: {maxWidth: 280},
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
  withProps<any, any>(() => ({
    headerStyle: {borderBottomWidth: 0},
    title: 'Join a team',
  })),
  HeaderHoc,
  branch((props: Props) => props.success, renderComponent(SuccessComponent))
)(EntryComponent as any)
