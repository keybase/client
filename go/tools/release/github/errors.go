package github

import "fmt"

type ErrNotFound struct {
	Name  string
	Key   string
	Value string
}

func (e ErrNotFound) Error() string {
	return fmt.Sprintf("%s not found with %s: %s", e.Name, e.Key, e.Value)
}
