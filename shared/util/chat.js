// @flow

function formatTextForQuoting(text: string) {
  const lines = text.split('\n')
  const res = []

  for (const line of lines) {
    res.push(`> ${line}`)
  }
  return res.join('\n').concat('\n')
}

export {formatTextForQuoting}
