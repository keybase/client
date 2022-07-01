import React from 'react'

function renderElementOrComponentOrNot(
  item: React.ComponentType<any> | React.ReactElement | null | undefined
): React.ReactElement | undefined {
  if (item) {
    if (React.isValidElement(item)) {
      return item
    } else {
      return React.createElement(item)
    }
  }
  return undefined
}

export {renderElementOrComponentOrNot}
