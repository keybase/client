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
    .map(line => `> ${line}\n`)
    .join('')

export {formatTextForQuoting}
