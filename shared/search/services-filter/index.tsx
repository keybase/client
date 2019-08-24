// The filter bar for search. Lets you select a search provider
import * as Types from '../../constants/types/search'
import React, {Component} from 'react'
import {Box, Icon, ClickableBox, Text, IconType} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, transition, isMobile, platformStyles} from '../../styles'

type Props = {
  // eslint-disable-next-line
  selectedService: Types.Service
  onSelectService: (service: Types.Service) => void
}

const bubbleColors = {
  Facebook: '#3B5998',
  GitHub: '#333333',
  'Hacker News': '#FF6600',
  Keybase: globalColors.blue,
  Reddit: '#CEE3F8',
  Twitter: '#1DA1F2',
}

const servicesOrder = ['Keybase', 'Twitter', 'Facebook', 'GitHub', 'Reddit', 'Hacker News']

const selectedIconMap: {[K in Types.Service]: IconType} = {
  Facebook: isMobile ? 'icon-search-facebook-active-40' : 'icon-search-facebook-active-32',
  GitHub: isMobile ? 'icon-search-github-active-40' : 'icon-search-github-active-32',
  'Hacker News': isMobile ? 'icon-search-hacker-news-active-40' : 'icon-search-hacker-news-active-32',
  Keybase: isMobile ? 'icon-search-keybase-active-40' : 'icon-search-keybase-active-32',
  Reddit: isMobile ? 'icon-search-reddit-active-40' : 'icon-search-reddit-active-32',
  Twitter: isMobile ? 'icon-search-twitter-active-40' : 'icon-search-twitter-active-32',
}

const unselectedIconMap: {[K in Types.Service]: IconType} = {
  Facebook: isMobile ? 'icon-search-facebook-inactive-40' : 'icon-search-facebook-inactive-32',
  GitHub: isMobile ? 'icon-search-github-inactive-40' : 'icon-search-github-inactive-32',
  'Hacker News': isMobile ? 'icon-search-hacker-news-inactive-40' : 'icon-search-hacker-news-inactive-32',
  Keybase: isMobile ? 'icon-search-keybase-inactive-40' : 'icon-search-keybase-inactive-32',
  Reddit: isMobile ? 'icon-search-reddit-inactive-40' : 'icon-search-reddit-inactive-32',
  Twitter: isMobile ? 'icon-search-twitter-inactive-40' : 'icon-search-twitter-inactive-32',
}

const Service = ({service, selected, hovering, onHover, onSelect}) => {
  let backgroundColor: string | undefined

  if (hovering && !selected) {
    backgroundColor = globalColors.blueLighter2
  } else if (selected) {
    backgroundColor = bubbleColors[service]
  }

  const boxProps = isMobile
    ? {
        onPressIn: () => onHover(service, true),
        onPressOut: () => onHover(service, false),
        style: {
          ...globalStyles.flexBoxCenter,
          backgroundColor,
          borderRadius: 20,
          height: 40,
          width: 40,
        },
      }
    : {
        onMouseEnter: () => onHover(service, true),
        onMouseLeave: () => onHover(service, false),
        style: {
          ...globalStyles.flexBoxCenter,
          backgroundColor,
          borderRadius: 16,
          height: 32,
          width: 32,
        },
      }

  const tooltipStyleHovering = hovering
    ? {opacity: 1, pointerEvents: 'cursor'}
    : {opacity: 0, pointerEvents: 'none'}

  return (
    <ClickableBox key={service} onClick={() => onSelect(service)} {...boxProps}>
      <Icon type={selected ? selectedIconMap[service] : unselectedIconMap[service]} />
      {!isMobile && (
        <Box
          style={{
            ...serviceTooltipStyle,
            ...tooltipStyleHovering,
          }}
        >
          <Text type="BodySmall" style={{color: globalColors.white}}>
            {service}
          </Text>
        </Box>
      )}
    </ClickableBox>
  )
}

// Holds all the services and keeps track of which one is hovered
class Filter extends Component<
  Props,
  {
    hoveredService: Types.Service | null
  }
> {
  state = {
    hoveredService: null,
  }

  _hoverChanged = (service: Types.Service, hovering: boolean) => {
    if (hovering) {
      this.setState({hoveredService: service})
    } else if (this.state.hoveredService === service) {
      this.setState({hoveredService: null})
    }
  }

  _selectService = (service: Types.Service) => {
    this.props.onSelectService(service)
  }

  render() {
    return (
      <Box style={styleServices}>
        {servicesOrder.map(service => (
          <Service
            key={service}
            service={service}
            selected={service === this.props.selectedService}
            hovering={service === this.state.hoveredService}
            onHover={this._hoverChanged}
            onSelect={this._selectService}
          />
        ))}
      </Box>
    )
  }
}
const styleServices = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 48,
  justifyContent: 'center',
}

const serviceTooltipPlatformStyle = platformStyles({
  isElectron: {
    ...transition('opacity'),
    cursor: 'default',
    height: 22,
    lineHeight: '22px',
    top: -28,
    width: 90,
  },
  isMobile: {
    height: 26,
    paddingBottom: globalMargins.xtiny,
    paddingTop: globalMargins.xtiny,
    top: -32,
    width: 100,
  },
})

const serviceTooltipStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.black_50,
  borderRadius: 20,
  justifyContent: 'center',
  position: 'absolute',
  ...serviceTooltipPlatformStyle,
}

export default Filter
