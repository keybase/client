package libkb

import (
	"fmt"
)

type Warning interface {
	Warning() string
}

type StringWarning string

func (s StringWarning) Warning() string {
	return string(s)
}

func Warningf(format string, a ...interface{}) Warning {
	return StringWarning(fmt.Sprintf(format, a...))
}

func ErrorToWarning(e error) Warning {
	if e == nil {
		return nil
	} else {
		return StringWarning(e.Error())
	}
}

type Warnings []Warning

func (w Warnings) Warn() {
	for _, e := range w {
		G.Log.Warning(e.Warning())
	}
}
