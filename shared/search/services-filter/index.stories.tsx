import * as React from 'react'
import ServicesFilter from '.'
import {Box} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'

const load = () => {
  storiesOf('Search', module).add('Filter', () => {
    const common = {onSelectService: action('Selected service')}

    return (
      <Box>
        <ServicesFilter {...common} selectedService="Keybase" />
        <ServicesFilter {...common} selectedService="Twitter" />
        <ServicesFilter {...common} selectedService="Facebook" />
        <ServicesFilter {...common} selectedService="GitHub" />
        <ServicesFilter {...common} selectedService="Reddit" />
        <ServicesFilter {...common} selectedService="Hacker News" />
      </Box>
    )
  })
}

export default load
