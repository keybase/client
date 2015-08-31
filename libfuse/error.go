package libfuse

// Error defines errors with codes
type Error struct {
	Code    int
	Message string
}

const (
	// InitErrorCode is the error code for initialization errors
	InitErrorCode = 1
	// MountErrorCode is the error code for mount errors
	MountErrorCode = 2
)

// InitError is for initialization errors
func InitError(message string) *Error {
	return &Error{InitErrorCode, message}
}

// MountError is for mount errors
func MountError(message string) *Error {
	return &Error{MountErrorCode, message}
}
