package main

type NoTerminalError struct{}

func (e NoTerminalError) Error() string {
	return "No Terminal available"
}

type InputCanceledError struct{}

func (e InputCanceledError) Error() string {
	return "Input canceled"
}

type NotConfirmedError struct{}

func (e NotConfirmedError) Error() string {
	return "Not confirmed"
}
