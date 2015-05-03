package client

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

type BadArgsError struct {
	msg string
}

func (e BadArgsError) Error() string {
	return "bad command-line arguments: " + e.msg
}

type CleanCancelError struct{}

func (e CleanCancelError) Error() string {
	return "clean cancel"
}

type CanceledError struct {
	msg string
}

type BadServiceError struct {
	n string
}

func (e BadServiceError) Error() string {
	return e.n + ": unsupported service"
}

type BadUsernameError struct {
	n string
}

func (e BadUsernameError) Error() string {
	return "Bad username: '" + e.n + "'"
}

type InternalError struct {
	m string
}

func (e InternalError) Error() string {
	return "Internal error: " + e.m
}

type ProofNotYetAvailableError struct{}

func (e ProofNotYetAvailableError) Error() string {
	return "Proof wasn't available; we'll keep trying"
}
