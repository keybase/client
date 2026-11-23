/** @jest-environment jsdom */
/// <reference types="jest" />
import {makeMessageRequestPayment, makeMessageSendPayment} from '@/constants/chat/message'
import {cleanup, render, screen} from '@testing-library/react'
import PaymentMessage from './container'

afterEach(() => {
  cleanup()
})

test('a sent payment renders as static text', () => {
  render(<PaymentMessage message={makeMessageSendPayment({})} />)
  expect(screen.getByText(/Payment sent\./)).toBeTruthy()
  expect(screen.getByText(/no longer supported in the Keybase app/)).toBeTruthy()
})

test('a requested payment renders as static text', () => {
  render(<PaymentMessage message={makeMessageRequestPayment({})} />)
  expect(screen.getByText(/Payment requested\./)).toBeTruthy()
})
