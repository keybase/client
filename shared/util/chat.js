// @flow

function formatTextForQuoting(text) {
  const lines = text.split('\n')
  const res = []

  for (const line of lines) {
    res.push(`> ${line}`)
  }
  res.push('\n')
  return res.join('\n')
}

export {formatTextForQuoting}
