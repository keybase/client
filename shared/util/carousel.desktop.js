/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import _ from 'lodash'

import {globalStyles, globalColors} from '../styles/style-guide'
import {Text, Icon} from '../common-adapters'

export type CarouselProps = {
  style?: ?Object,
  itemWidth: number
}

class CarouselThing extends Component {
  render () {
    return (
      <div style={{...this.props.style}}>
        <Text style={{margin: 20}} type='Body'>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus sagittis lacus vel augue laoreet.</Text>
      </div>
    )
  }
}

function PageIndicator ({selectedIndex, itemCount, style, onClickPage}: {selectedIndex: number, itemCount: number, style: Object, onClickPage: (i: number) => void}) {
  const marks = _.range(itemCount).map(n => {
    const color = (n === selectedIndex) ? globalColors.white : globalColors.blue2
    return (<Icon type='fa-circle' style={{color, ...styles.pageIndicator}} onClick={() => onClickPage(n)} key={n}/>)
  })
  return (
    <div style={style}>{marks}</div>
  )
}

export default class Carousel extends Component {
  props: CarouselProps;
  state: {selectedIndex: number, itemCount: number};

  interval: number;
  timeout: number;

  constructor (props: CarouselProps) {
    super(props)
    this.state = {selectedIndex: 0, itemCount: 4}
    this.timeout = 5e3
  }

  incrementIndex () {
    this.setState({selectedIndex: (this.state.selectedIndex + 1) % this.state.itemCount})
  }

  componentDidMount () {
    // timer to change the state
    this.interval = setInterval(() => this.incrementIndex(), this.timeout)
  }

  componentWillUnmount () {
    clearInterval(this.interval)
  }

  resetIndex (i: number) {
    this.setState({selectedIndex: i})
    // Reset the timer so we don't change index as soon as the user clicks a page.
    clearInterval(this.interval)
    this.interval = setInterval(() => this.incrementIndex(), this.timeout)
  }

  render () {
    const marginLeft = this.state.selectedIndex * -(this.props.itemWidth + 20)
    const itemWidth = this.props.itemWidth
    return (
      <div style={{...styles.carousel, ...this.props.style}}>
        <div style={{...globalStyles.flexBoxRow, width: itemWidth, overflow: 'visible'}}>
          <div style={{...styles.carouselWrapper, marginLeft}}>
            {_.range(this.state.itemCount)
              .map(i => <CarouselThing style={{...styles.carouselThing, ...globalStyles.rounded, width: itemWidth}} key={i}/>)}
          </div>
        </div>
        <PageIndicator style={{alignSelf: 'center'}} selectedIndex={this.state.selectedIndex} itemCount={this.state.itemCount} onClickPage={i => this.resetIndex(i)}/>
      </div>
    )
  }
}

const styles = {
  carousel: {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColors.blue,
    alignItems: 'center',
    overflow: 'hidden'
  },

  carouselWrapper: {
    ...globalStyles.flexBoxRow,
    transition: 'margin-left 1s ease-in-out'
  },

  carouselThing: {
    height: 431,
    marginTop: 20,
    marginBottom: 20,
    marginRight: 20,
    backgroundColor: globalColors.white
  },

  pageIndicator: {
    ...globalStyles.clickable,
    transition: 'color 1s ease-in-out',
    fontSize: 10,
    marginLeft: 4,
    width: 8,
    height: 8,
    marginRight: 4
  }
}
