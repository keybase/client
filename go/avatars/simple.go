package avatars

import (
	"context"
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type apiUserAvatarRes struct {
	Status   libkb.AppStatus                                `json:"status"`
	Pictures []map[keybase1.AvatarFormat]keybase1.AvatarUrl `json:"pictures"`
}

func (a apiUserAvatarRes) GetAppStatus() *libkb.AppStatus {
	return &a.Status
}

type SimpleSource struct {
	libkb.Contextified
}

func NewSimpleSource(g *libkb.GlobalContext) *SimpleSource {
	return &SimpleSource{
		Contextified: libkb.NewContextified(g),
	}
}

func (s *SimpleSource) formatArg(formats []keybase1.AvatarFormat) string {
	var strs []string
	for _, f := range formats {
		strs = append(strs, f.String())
	}
	return strings.Join(strs, ",")
}

func (s *SimpleSource) api() libkb.API {
	return s.G().API
}

func (s *SimpleSource) debug(ctx context.Context, msg string, args ...interface{}) {
	s.G().Log.CDebugf(ctx, "Avatars.SimpleSource: %s", fmt.Sprintf(msg, args...))
}

func (s *SimpleSource) allocUserRes(res *keybase1.LoadUserAvatarsRes, usernames []string) {
	res.Picmap = make(map[string]map[keybase1.AvatarFormat]keybase1.AvatarUrl)
	for _, u := range usernames {
		res.Picmap[u] = make(map[keybase1.AvatarFormat]keybase1.AvatarUrl)
	}
}

func (s *SimpleSource) LoadUsers(ctx context.Context, usernames []string, formats []keybase1.AvatarFormat) (res keybase1.LoadUserAvatarsRes, err error) {
	defer s.G().Trace("SimpleSource.LoadUsers", func() error { return err })()

	// pass through to API server
	arg := libkb.NewAPIArgWithNetContext(ctx, "image/username_pic_lookups")
	arg.Args = libkb.NewHTTPArgs()
	arg.SessionType = libkb.APISessionTypeOPTIONAL
	uarg := strings.Join(usernames, ",")
	farg := s.formatArg(formats)
	arg.Args.Add("usernames", libkb.S{Val: uarg})
	arg.Args.Add("formats", libkb.S{Val: farg})
	var apiRes apiUserAvatarRes
	if err := s.api().GetDecode(arg, &apiRes); err != nil {
		s.debug(ctx, "LoadUsers: API fail: %s", err)
		return res, err
	}
	if len(apiRes.Pictures) != len(usernames) {
		return res, fmt.Errorf("invalid API server response, wrong number of users: %d != %d",
			len(apiRes.Pictures), len(usernames))
	}
	s.allocUserRes(&res, usernames)
	for index, rec := range apiRes.Pictures {
		u := usernames[index]
		for format, url := range rec {
			res.Picmap[u][format] = url
		}
	}
	return res, nil
}
