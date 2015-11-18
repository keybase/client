// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package auth

import "fmt"

type InvalidTokenTypeError struct {
	ExpectedTokenType string
	ReceivedTokenType string
}

func (e InvalidTokenTypeError) Error() string {
	return fmt.Sprintf("Invalid token type, expected: %s, received: %s",
		e.ExpectedTokenType, e.ReceivedTokenType)
}

type MaxTokenExpiresError struct {
	CreationTime int64
	ExpireIn     int
	Now          int64
	MaxExpireIn  int
	Remaining    int
}

func (e MaxTokenExpiresError) Error() string {
	return fmt.Sprintf("Max token expiration exceeded, ctime/expire_in: %d/%d, "+
		"now/max: %d/%d, remaining: %d", e.CreationTime, e.ExpireIn,
		e.Now, e.MaxExpireIn, e.Remaining)
}

type TokenExpiredError struct {
	CreationTime int64
	ExpireIn     int
	Now          int64
}

func (e TokenExpiredError) Error() string {
	return fmt.Sprintf("Token expired, ctime/expire_in: %d/%d, now: %d",
		e.CreationTime, e.ExpireIn, e.Now)
}
