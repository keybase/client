const isHTMLElement = (node: unknown): node is HTMLElement => {
  return node instanceof HTMLElement
}

export const findDOMClass = (
  htmlNode: HTMLElement | undefined | null,
  className: string
): undefined | HTMLElement => {
  let currentNode = htmlNode
  while (currentNode) {
    if (currentNode.classList.contains(className)) {
      return currentNode
    }
    const p = isHTMLElement(currentNode.parentNode) ? currentNode.parentElement : undefined
    currentNode = p
  }
  return
}
