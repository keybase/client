// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package avatars

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"os"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

func addFile(mpart *multipart.Writer, param, filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	part, err := mpart.CreateFormFile(param, filename)
	if err != nil {
		return err
	}

	_, err = io.Copy(part, file)
	return err
}

type imageCropParams struct {
	x0, y0, x1, y1 int
}

func postAvatarImage(mctx libkb.MetaContext, filename string, crop *imageCropParams, teamID *keybase1.TeamID) (err error) {
	var body bytes.Buffer
	mpart := multipart.NewWriter(&body)

	if err := addFile(mpart, "avatar", filename); err != nil {
		mctx.CDebugf("addFile error: %s", err)
		return err
	}

	if teamID != nil {
		mpart.WriteField("team_id", string(*teamID))
	}

	if crop != nil {
		mpart.WriteField("x0", fmt.Sprintf("%d", crop.x0))
		mpart.WriteField("y0", fmt.Sprintf("%d", crop.y0))
		mpart.WriteField("x1", fmt.Sprintf("%d", crop.x1))
		mpart.WriteField("y1", fmt.Sprintf("%d", crop.y1))
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

	mctx.CDebugf("Running POST to %s", endpoint)

	arg := libkb.APIArg{
		Endpoint:    endpoint,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err = mctx.G().API.PostRaw(arg, mpart.FormDataContentType(), &body)
	if err != nil {
		mctx.CDebugf("post error: %s", err)
		return err
	}

	return nil
}

func UploadImage(mctx libkb.MetaContext, filename string, teamname *string) error {
	var teamID *keybase1.TeamID
	if teamname != nil {
		team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
			Name:        *teamname,
			Public:      false,
			ForceRepoll: false,
			NeedAdmin:   true,
		})
		if err != nil {
			return err
		}
		teamID = &team.ID
	}
	return postAvatarImage(mctx, filename, nil, teamID)
}
