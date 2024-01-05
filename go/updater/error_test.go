// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewError(t *testing.T) {
	err := NewError(PromptError, fmt.Errorf("There was an error prompting"))
	assert.EqualError(t, err, "Update Error (prompt): There was an error prompting")
}

func TestNewErrorNil(t *testing.T) {
	err := NewError(PromptError, nil)
	assert.EqualError(t, err, "Update Error (prompt)")
}
