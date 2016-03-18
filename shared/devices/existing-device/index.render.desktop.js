import React from 'react'
import {Text, Icon} from '../../common-adapters'
import {globalStyles, globalColors, transition} from '../../styles/style-guide'
import Container from '../../login/forms/container'

const Item = ({onClick, icon, title}) => {
  return (
    <div className='existing-device-container' style={styles.item} onClick={onClick}>
      <div className='existing-device-item' style={styles.iconContainer}>
        <Icon type={icon} style={styles.icon} inheritColor/>
      </div>
      <Text link type='Header'>{title}</Text>
    </div>
  )
}

const Render = ({onBack, onSubmitComputer, onSubmitPhone}) => {
  const realCSS = `
  .existing-device-container .existing-device-item {
    background-color: ${globalColors.lightGrey};
    color: ${globalColors.black75};
  }
  .existing-device-container:hover .existing-device-item {
    background-color: ${globalColors.blue4};
    color: ${globalColors.black};
  }
  `

  return (
    <Container
      style={styles.container}
      onBack={() => onBack()}>
      <style>{realCSS}</style>
      <Text type='Header' style={styles.header}>What’s your other device?</Text>
      <div style={styles.itemContainer}>
        <Item title='Phone' icon='fa-mobile' onClick={() => onSubmitPhone()}/>
        <Item title='Computer' icon='fa-laptop' onClick={() => onSubmitComputer()}/>
      </div>
    </Container>
  )
}

const styles = {
  container: {
    flex: 1,
    alignItems: 'center'
  },
  header: {
    marginTop: 46
  },
  itemContainer: {
    ...globalStyles.flexBoxRow,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  item: {
    ...globalStyles.flexBoxColumn,
    ...globalStyles.clickable,
    alignItems: 'center',
    margin: 15,
    width: 150
  },
  iconContainer: {
    ...globalStyles.flexBoxColumn,
    ...transition(['color', 'background-color']),
    alignItems: 'center',
    borderRadius: 150 / 2,
    height: 150,
    justifyContent: 'center',
    marginBottom: 15,
    width: 150
  },
  icon: {
    fontSize: 78,
    width: 80,
    height: 80,
    textAlign: 'center'
  }
}

export default Render
