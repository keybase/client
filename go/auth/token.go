// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//
// Code used to support authentication tokens for arbitrary purposes.
//
package auth

import (
	"time"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

const CurrentTokenVersion = 1

type Token struct {
	User          keybase1.UID
	Username      libkb.NormalizedUsername
	Key           keybase1.KID
	TokenType     string
	CreationTime  int64
	ExpireIn      int
	Tag           string
	Version       int
	ClientName    string
	ClientVersion string
}

func NewToken(user keybase1.UID, username libkb.NormalizedUsername, key keybase1.KID,
	tokenType string, expireIn int, clientName string, clientVersion string) *Token {
	return &Token{
		User:          user,
		Username:      username,
		Key:           key,
		TokenType:     tokenType,
		CreationTime:  time.Now().Unix(),
		ExpireIn:      expireIn,
		ClientName:    clientName,
		ClientVersion: clientVersion,
	}
}

func ParseToken(token string) (*Token, error) {
	jw, err := jsonw.Unmarshal([]byte(token))
	if err != nil {
		return nil, err
	}
	t := &Token{}
	if err := t.fromJSON(jw); err != nil {
		return nil, err
	}
	return t, nil
}

func (arg Token) Bytes() []byte {
	var err error
	var tmp []byte
	if tmp, err = arg.toJSON().Marshal(); err != nil {
		return []byte{}
	}
	return tmp
}

func (arg Token) String() string {
	return string(arg.Bytes())
}

func (arg Token) Verify(signature, tokenType string, maxExpireIn int) error {
	key, err := libkb.ImportKeypairFromKID(arg.Key)
	if err != nil {
		return err
	}
	if _, err := key.VerifyString(signature, arg.Bytes()); err != nil {
		return err
	}
	if tokenType != arg.TokenType {
		return InvalidTokenTypeError{
			ExpectedTokenType: tokenType,
			ReceivedTokenType: arg.TokenType,
		}
	}
	remaining := arg.TimeRemaining()
	if remaining > maxExpireIn {
		return MaxTokenExpiresError{
			CreationTime: arg.CreationTime,
			ExpireIn:     arg.ExpireIn,
			Now:          time.Now().Unix(),
			MaxExpireIn:  maxExpireIn,
			Remaining:    remaining,
		}
	}
	if remaining <= 0 {
		return TokenExpiredError{
			CreationTime: arg.CreationTime,
			ExpireIn:     arg.ExpireIn,
			Now:          time.Now().Unix(),
		}
	}
	return nil
}

func (arg Token) TimeRemaining() int {
	now := time.Now().Unix()
	expires := arg.CreationTime + int64(arg.ExpireIn)
	return int(expires - now)
}

type keySection struct {
	User     keybase1.UID
	Username libkb.NormalizedUsername
	Key      keybase1.KID
}

func (arg keySection) toJSON() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("kid", jsonw.NewString(arg.Key.String()))
	ret.SetKey("uid", jsonw.NewString(arg.User.String()))
	ret.SetKey("username", jsonw.NewString(arg.Username.String()))
	return ret
}

func (arg *keySection) fromJSON(key *jsonw.Wrapper) error {
	kid, err := key.AtPath("kid").GetString()
	if err != nil {
		return err
	}
	uid, err := key.AtPath("uid").GetString()
	if err != nil {
		return err
	}
	name, err := key.AtPath("username").GetString()
	if err != nil {
		return err
	}
	arg.Key = keybase1.KID(kid)
	arg.User = keybase1.UID(uid)
	arg.Username = libkb.NormalizedUsername(name)
	return nil
}

type clientSection struct {
	Name    string
	Version string
}

func (arg clientSection) toJSON() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("name", jsonw.NewString(arg.Name))
	ret.SetKey("version", jsonw.NewString(arg.Version))
	return ret
}

func (arg *clientSection) fromJSON(client *jsonw.Wrapper) error {
	name, err := client.AtPath("name").GetString()
	if err != nil {
		return err
	}
	version, err := client.AtPath("version").GetString()
	if err != nil {
		return err
	}
	arg.Name = name
	arg.Version = version
	return nil
}

func (arg Token) toJSON() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("tag", jsonw.NewString("signature"))
	ret.SetKey("ctime", jsonw.NewInt64(arg.CreationTime))
	ret.SetKey("expire_in", jsonw.NewInt(arg.ExpireIn))

	body := jsonw.NewDictionary()
	body.SetKey("version", jsonw.NewInt(CurrentTokenVersion))
	body.SetKey("type", jsonw.NewString(arg.TokenType))

	key := keySection{
		User:     arg.User,
		Username: arg.Username,
		Key:      arg.Key,
	}.toJSON()
	body.SetKey("key", key)
	ret.SetKey("body", body)

	client := clientSection{
		Name:    arg.ClientName,
		Version: arg.ClientVersion,
	}.toJSON()
	ret.SetKey("client", client)
	return ret
}

func (arg *Token) fromJSON(token *jsonw.Wrapper) error {
	tag, err := token.AtPath("tag").GetString()
	if err != nil {
		return err
	}
	ctime, err := token.AtPath("ctime").GetInt64()
	if err != nil {
		return err
	}
	expireIn, err := token.AtPath("expire_in").GetInt()
	if err != nil {
		return err
	}

	body := token.AtPath("body")
	tokenType, err := body.AtPath("type").GetString()
	if err != nil {
		return err
	}
	version, err := body.AtPath("version").GetInt()
	if err != nil {
		return err
	}

	key := body.AtPath("key")
	var ks keySection
	if err := ks.fromJSON(key); err != nil {
		return err
	}

	client := token.AtPath("client")
	var cs clientSection
	if err := cs.fromJSON(client); err != nil {
		return err
	}

	arg.User = ks.User
	arg.Username = ks.Username
	arg.Key = ks.Key
	arg.TokenType = tokenType
	arg.CreationTime = ctime
	arg.ExpireIn = expireIn
	arg.Tag = tag
	arg.Version = version
	arg.ClientName = cs.Name
	arg.ClientVersion = cs.Version
	return nil
}
