package main

import "errors"

var (
	NoTerminalError           = errors.New("No Terminal available")
	InputCanceledError        = errors.New("Input canceled")
	NotConfirmedError         = errors.New("Not confirmed")
	CleanCancelError          = errors.New("clean cancel")
	ProofNotYetAvailableError = errors.New("Proof wasn't available; we'll keep trying")
)

type BadArgsError string

func (e BadArgsError) Error() string {
	return "bad command-line arguments: " + string(e)
}

type CanceledError string

type BadServiceError string

func (e BadServiceError) Error() string {
	return string(e) + ": unsupported service"
}

type BadUsernameError string

func (e BadUsernameError) Error() string {
	return "Bad username: '" + string(e) + "'"
}

type InternalError string

func (e InternalError) Error() string {
	return "Internal error: " + string(e)
}
