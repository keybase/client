package config

import "fmt"

// ErrInvalidPermissions is returned when an invalid permissions string appears
// in the config.
type ErrInvalidPermissions struct {
	permissions string
}

// Error implements the error interface.
func (e ErrInvalidPermissions) Error() string {
	return "invalid permission(s) " + e.permissions
}

// ErrDuplicateAccessControlPath is returned when multiple ACLs are defined for
// the same path in config.
type ErrDuplicateAccessControlPath struct {
	cleanedPath string
}

// Error implements the error interface.
func (e ErrDuplicateAccessControlPath) Error() string {
	return "duplicate access control for " + e.cleanedPath
}

// ErrInvalidVersion is returned when Version field of the config is invalid.
type ErrInvalidVersion struct {
	versionStr string
}

// Error implements the error interface.
func (e ErrInvalidVersion) Error() string {
	return fmt.Sprintf("invalid version %s", e.versionStr)
}

// ErrUndefinedUsername is returned when a username appears in a ACL but it's
// not defined in the config's Users section.
type ErrUndefinedUsername struct {
	username string
}

// Error implements the error interface.
func (e ErrUndefinedUsername) Error() string {
	return fmt.Sprintf("undefined username %s", e.username)
}
