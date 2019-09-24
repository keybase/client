// The filter bar for search. Lets you select a search provider
import * as Types from '../../constants/types/search'
import React, {Component} from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  // eslint-disable-next-line
  selectedService: Types.Service
  onSelectService: (service: Types.Service) => void
}

const bubbleColors = {
  Facebook: '#3B5998',
  GitHub: '#333333',
  'Hacker News': '#FF6600',
  Keybase: Styles.globalColors.blue,
  Reddit: '#CEE3F8',
  Twitter: '#1DA1F2',
}

const servicesOrder = ['Keybase', 'Twitter', 'Facebook', 'GitHub', 'Reddit', 'Hacker News']

const selectedIconMap: {[K in Types.Service]: Kb.IconType} = {
  Facebook: Styles.isMobile ? 'icon-search-facebook-active-40' : 'icon-search-facebook-active-32',
  GitHub: Styles.isMobile ? 'icon-search-github-active-40' : 'icon-search-github-active-32',
  'Hacker News': Styles.isMobile ? 'icon-search-hacker-news-active-40' : 'icon-search-hacker-news-active-32',
  Keybase: Styles.isMobile ? 'icon-search-keybase-active-40' : 'icon-search-keybase-active-32',
  Reddit: Styles.isMobile ? 'icon-search-reddit-active-40' : 'icon-search-reddit-active-32',
  Twitter: Styles.isMobile ? 'icon-search-twitter-active-40' : 'icon-search-twitter-active-32',
}

const unselectedIconMap: {[K in Types.Service]: Kb.IconType} = {
  Facebook: Styles.isMobile ? 'icon-search-facebook-inactive-40' : 'icon-search-facebook-inactive-32',
  GitHub: Styles.isMobile ? 'icon-search-github-inactive-40' : 'icon-search-github-inactive-32',
  'Hacker News': Styles.isMobile
    ? 'icon-search-hacker-news-inactive-40'
    : 'icon-search-hacker-news-inactive-32',
  Keybase: Styles.isMobile ? 'icon-search-keybase-inactive-40' : 'icon-search-keybase-inactive-32',
  Reddit: Styles.isMobile ? 'icon-search-reddit-inactive-40' : 'icon-search-reddit-inactive-32',
  Twitter: Styles.isMobile ? 'icon-search-twitter-inactive-40' : 'icon-search-twitter-inactive-32',
}

const Service = ({service, selected, hovering, onHover, onSelect}) => {
  let backgroundColor: string | undefined

  if (hovering && !selected) {
    backgroundColor = Styles.globalColors.blueLighter2
  } else if (selected) {
    backgroundColor = bubbleColors[service]
  }

  const boxProps = Styles.isMobile
    ? {
        onPressIn: () => onHover(service, true),
        onPressOut: () => onHover(service, false),
        style: {
          ...Styles.globalStyles.flexBoxCenter,
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
          ...Styles.globalStyles.flexBoxCenter,
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
    <Kb.ClickableBox key={service} onClick={() => onSelect(service)} {...boxProps}>
      <Kb.Icon type={selected ? selectedIconMap[service] : unselectedIconMap[service]} />
      {!Styles.isMobile && (
        <Kb.Box
          style={{
            ...styles.serviceTooltip,
            ...tooltipStyleHovering,
          }}
        >
          <Kb.Text type="BodySmall" style={{color: Styles.globalColors.white}}>
            {service}
          </Kb.Text>
        </Kb.Box>
      )}
    </Kb.ClickableBox>
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
      <Kb.Box style={styles.services}>
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
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      serviceTooltip: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          backgroundColor: Styles.globalColors.black_50,
          borderRadius: 20,
          justifyContent: 'center',
          position: 'absolute',
        },
        isElectron: {
          ...Styles.transition('opacity'),
          cursor: 'default',
          height: 22,
          lineHeight: '22px',
          top: -28,
          width: 90,
        },
        isMobile: {
          height: 26,
          paddingBottom: Styles.globalMargins.xtiny,
          paddingTop: Styles.globalMargins.xtiny,
          top: -32,
          width: 100,
        },
      }),
      services: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 48,
        justifyContent: 'center',
      },
    } as const)
)

export default Filter
