import {stepAttachmentName} from '../../shared/step-name'
import {tailLines, uncaughtErrors, UNCAUGHT_PREFIX} from './step-lib'

test('step attachments are numbered and kebab-cased', () => {
  expect(stepAttachmentName(1, 'Opened the Settings tab!')).toBe('step-01-opened-the-settings-tab')
  expect(stepAttachmentName(12, 'a  b')).toBe('step-12-a-b')
})

test('tailLines keeps the last lines and drops a cut first line', () => {
  expect(tailLines('a\nb\nc\nd\n', 2)).toBe('c\nd')
  expect(tailLines('a\nb', 5)).toBe('a\nb')
})

test('only errors the global handler caught are uncaught', () => {
  expect(uncaughtErrors(['plain', `${UNCAUGHT_PREFIX}Error: boom`])).toEqual([`${UNCAUGHT_PREFIX}Error: boom`])
  expect(uncaughtErrors(['plain'])).toEqual([])
})
