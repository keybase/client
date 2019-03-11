// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package avatars

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func addFile(mpart *multipart.Writer, param, filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	// do not disclose our filename to the server
	part, err := mpart.CreateFormFile(param, "image" /* filename */)
	if err != nil {
		return err
	}

	_, err = io.Copy(part, file)
	return err
}

func UploadImage(mctx libkb.MetaContext, filename string, teamID *keybase1.TeamID, crop *keybase1.ImageCropRect) (err error) {
	var body bytes.Buffer
	mpart := multipart.NewWriter(&body)

	if err := addFile(mpart, "avatar", filename); err != nil {
		mctx.Debug("addFile error: %s", err)
		return err
	}

	// Server checks upload size as well.
	const maxUploadSize = 20 * 1024 * 1024
	if bodyLen := body.Len(); bodyLen > maxUploadSize {
		return fmt.Errorf("Image is too big: tried to upload %d bytes, max size is %d bytes.",
			bodyLen, maxUploadSize)
	}

	if teamID != nil {
		mpart.WriteField("team_id", string(*teamID))
	}

	if crop != nil {
		mctx.Debug("Adding crop fields: %+v", crop)
		mpart.WriteField("x0", fmt.Sprintf("%d", crop.X0))
		mpart.WriteField("y0", fmt.Sprintf("%d", crop.Y0))
		mpart.WriteField("x1", fmt.Sprintf("%d", crop.X1))
		mpart.WriteField("y1", fmt.Sprintf("%d", crop.Y1))
	}

	if err := mpart.Close(); err != nil {
		return err
	}

	var endpoint string
	if teamID != nil {
		endpoint = "image/upload_team_avatar"
	} else {
		endpoint = "image/upload_user_avatar"
	}

	mctx.Debug("Running POST to %s", endpoint)

	arg := libkb.APIArg{
		Endpoint:       endpoint,
		SessionType:    libkb.APISessionTypeREQUIRED,
		InitialTimeout: 5 * time.Minute,
		RetryCount:     1,
	}

	_, err = mctx.G().API.PostRaw(mctx, arg, mpart.FormDataContentType(), &body)
	if err != nil {
		mctx.Debug("post error: %s", err)
		return err
	}

	return nil
}
