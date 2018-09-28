// @flow
import * as React from 'react'
import * as I from 'immutable'
import Box from './box'
import Button from './button'
import PlainInput from './plain-input'
import * as MultiPopupDialog from './multi-popup-dialog'
import {action, storiesOf} from '../stories/storybook'
import * as Styles from '../styles'

const load = () => {
  storiesOf('Common', module).add('MultiPopupDialog', () => (
    <MultiPopupDialog.Dialog
      onClose={action('onClose')}
      childrenMap={I.Map({
        a: (
          <MultiPopupDialog.Consumer>
            {context => (
              <Box style={styles.box}>
                <PlainInput placeholder="smth to keep in state" />
                <Button type="Primary" onClick={() => context.multiPopupDialogAppend('b')} label="Goto 'b'" />
                <Button type="Primary" label="No more Back!" disabled={true} />
              </Box>
            )}
          </MultiPopupDialog.Consumer>
        ),
        b: (
          <MultiPopupDialog.Consumer>
            {context => (
              <Box style={styles.box}>
                <PlainInput placeholder="smth to keep in state" />
                <Button type="Primary" onClick={() => context.multiPopupDialogAppend('c')} label="Goto 'c'" />
                <Button type="Primary" onClick={context.multiPopupDialogBack} label="Go Back" />
              </Box>
            )}
          </MultiPopupDialog.Consumer>
        ),
        c: (
          <MultiPopupDialog.Consumer>
            {context => (
              <Box style={styles.box}>
                <PlainInput placeholder="smth to keep in state" />
                <Button type="Primary" label="No more!" disabled={true} />
                <Button type="Primary" onClick={context.multiPopupDialogBack} label="Go Back" />
              </Box>
            )}
          </MultiPopupDialog.Consumer>
        ),
      })}
      initialChildKey="a"
    />
  ))
}

const styles = Styles.styleSheetCreate({
  box: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.white,
    height: 200,
    justifyContent: 'center',
    width: 200,
  },
})

export default load
