package kbchat

import "fmt"

type ErrorCode int

const (
	RevisionErrorCode          ErrorCode = 2760
	DeleteNonExistentErrorCode ErrorCode = 2762
)

// Error is for unmarshaling CLI json responses
type Error struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
}

func (e Error) Error() string {
	return fmt.Sprintf("received error response from keybase api: %s", e.Message)
}

type APIError struct {
	err error
}

func (e APIError) Error() string {
	return fmt.Sprintf("failed to call keybase api: %v", e.err)
}

type UnmarshalError struct {
	err error
}

func (e UnmarshalError) Error() string {
	return fmt.Sprintf("failed to parse output from keybase api: %v", e.err)
}
