// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCombineErrors(t *testing.T) {
	assert.Equal(t, nil, CombineErrors(nil))
	assert.Equal(t, nil, CombineErrors(nil, nil))
	assert.Equal(t, "1 error", CombineErrors(errors.New("1 error"), nil).Error())
	assert.Equal(t, "1 error", CombineErrors(nil, errors.New("1 error")).Error())
	assert.Equal(t, "There were multiple errors: 1 error; 2 error", CombineErrors(nil, errors.New("1 error"), errors.New("2 error")).Error())
	assert.Equal(t, "There were multiple errors: 1 error; 2 error", CombineErrors(nil, errors.New("1 error"), errors.New("2 error"), nil).Error())
	assert.Equal(t, "There were multiple errors: 1 error; 2 error", CombineErrors(nil, errors.New("1 error"), nil, errors.New("2 error"), nil).Error())
}
