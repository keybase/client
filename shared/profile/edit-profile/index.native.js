// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'

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
      onEnterKeyDown={props.onSubmit}
      onChangeText={location => props.onLocationChange(location)}
    />
    {props.bioLengthLeft <= 5 && (
      <Kb.Text style={styles.errorText} type="BodySmallError">
        {props.bioLengthLeft} characters left.
      </Kb.Text>
    )}
    <Kb.ButtonBar fullWidth={true}>
      <Kb.Button
        disabled={props.bioLengthLeft <= 0}
        style={styles.button}
        type="Primary"
        onClick={props.onSubmit}
        label="Save"
      />
    </Kb.ButtonBar>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate({
  button: {
    marginTop: Styles.globalMargins.medium,
  },
  errorText: {
    textAlign: 'center',
  },
})

export default EditProfileRender
