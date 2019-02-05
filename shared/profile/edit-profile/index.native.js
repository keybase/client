// @flow
// // TODO deprecate
import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import {waitingKey} from '../../constants/tracker2'

import type {Props} from '.'

const EditProfileRender = (props: Props) => (
  <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
    <Kb.FormInput
      autoCorrect={true}
      autoFocus={true}
      label="Full name"
      value={props.fullname}
      onChangeText={fullname => props.onFullnameChange(fullname)}
      hideBottomBorder={true}
    />
    <Kb.FormInput
      autoCorrect={true}
      label="Bio"
      value={props.bio}
      multiline={true}
      maxHeight={180}
      onChangeText={bio => props.onBioChange(bio)}
      hideBottomBorder={true}
    />
    <Kb.FormInput
      autoCorrect={true}
      label="Location"
      value={props.location}
      onEnterKeyDown={props.bioLengthLeft >= 0 ? props.onSubmit : null}
      onChangeText={location => props.onLocationChange(location)}
    />
    {props.bioLengthLeft <= 5 && (
      <Kb.Text center={true} type="BodySmallError">
        {props.bioLengthLeft} characters left.
      </Kb.Text>
    )}
    <Kb.ButtonBar fullWidth={true}>
      <Kb.WaitingButton
        waitingKey={waitingKey}
        disabled={props.bioLengthLeft < 0}
        style={styles.button}
        type="Primary"
        onClick={props.onSubmit}
        label="Save"
      />
    </Kb.ButtonBar>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate({
  button: {marginTop: Styles.globalMargins.medium},
})

export default EditProfileRender
