

package libkbgo

import (
	"log"
	"os"
)

func NewDefaultLogger() *log.Logger {
	return log.New(os.Stderr, "keybase: ", 0)
}


