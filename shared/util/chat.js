// @flow

/*
Converts:
  foo
  bar
to:
  > foo
  > bar
*/
const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n')
    .concat('\n')

export {formatTextForQuoting}
