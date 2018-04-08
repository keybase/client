// @flow

function formatTextForQuoting(text) {
  const lines = text.split('\n')
  const res = []

  for (const line of lines) {
    res.push(`> ${line}`)
  }
  return res.join('\n')
}

export {formatTextForQuoting}
