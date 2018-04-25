// @flow
import * as React from 'react'
import PopupMenu from './popup-menu'
import Box from './box'
import {action, storiesOf} from '../stories/storybook'

const Wrapper = ({children}) => (
  <Box
    style={{
      borderColor: 'black',
      borderStyle: 'solid',
      borderWidth: 1,
      height: 300,
      position: 'relative',
    }}
  >
    {children}
  </Box>
)

const popupCommon = {
  onHidden: () => action('onhidden'),
  style: {marginLeft: 100, maxWidth: 320},
}

const popupItemCommon = {
  onClick: () => action('click'),
}

const load = () => {
  storiesOf('Common/PopupMenu', module)
    .add('Simple', () => (
      <Wrapper>
        <PopupMenu
          {...popupCommon}
          items={[
            {...popupItemCommon, title: 'One'},
            {...popupItemCommon, title: 'Two'},
            {...popupItemCommon, title: 'Three'},
          ]}
        />
      </Wrapper>
    ))
    .add('Complex', () => (
      <Wrapper>
        <PopupMenu
          {...popupCommon}
          items={[
            {...popupItemCommon, title: 'Open in Finder'},
            {...popupItemCommon, title: 'Ignore'},
            'Divider',
            {
              ...popupItemCommon,
              title: 'Clear history (3.24 MB)',
              subTitle: 'Deletes old copies of files.',
              danger: true,
            },
            {
              ...popupItemCommon,
              title: 'Delete files and clear history (5.17GB)',
              subTitle: 'Deletes everything in this folder, including its backup versions',
              danger: true,
            },
          ]}
        />
      </Wrapper>
    ))
}

export default load
