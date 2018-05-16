package avatars

import (
	"context"
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type apiAvatarRes struct {
	Status   libkb.AppStatus                                `json:"status"`
	Pictures []map[keybase1.AvatarFormat]keybase1.AvatarUrl `json:"pictures"`
}

func (a apiAvatarRes) GetAppStatus() *libkb.AppStatus {
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

var _ Source = (*SimpleSource)(nil)

func (s *SimpleSource) StartBackgroundTasks() {}
func (s *SimpleSource) StopBackgroundTasks()  {}

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

func (s *SimpleSource) apiReq(ctx context.Context, endpoint, param string, names []string,
	formats []keybase1.AvatarFormat) (apiAvatarRes, error) {
	arg := libkb.NewAPIArgWithNetContext(ctx, endpoint)
	arg.Args = libkb.NewHTTPArgs()
	arg.SessionType = libkb.APISessionTypeOPTIONAL
	uarg := strings.Join(names, ",")
	farg := s.formatArg(formats)
	arg.Args.Add(param, libkb.S{Val: uarg})
	arg.Args.Add("formats", libkb.S{Val: farg})
	s.debug(ctx, "issuing %s avatar req: uarg: %s farg: %s", param, uarg, farg)
	var apiRes apiAvatarRes
	if err := s.api().GetDecode(arg, &apiRes); err != nil {
		s.debug(ctx, "apiReq: API fail: %s", err)
		return apiRes, err
	}
	return apiRes, nil
}

func (s *SimpleSource) makeRes(res *keybase1.LoadAvatarsRes, apiRes apiAvatarRes, names []string) error {
	if len(apiRes.Pictures) != len(names) {
		return fmt.Errorf("invalid API server response, wrong number of users: %d != %d",
			len(apiRes.Pictures), len(names))
	}
	allocRes(res, names)
	for index, rec := range apiRes.Pictures {
		u := names[index]
		for format, url := range rec {
			res.Picmap[u][format] = url
		}
	}
	return nil
}

func (s *SimpleSource) debug(ctx context.Context, msg string, args ...interface{}) {
	s.G().Log.CDebugf(ctx, "Avatars.SimpleSource: %s", fmt.Sprintf(msg, args...))
}

func (s *SimpleSource) LoadUsers(ctx context.Context, usernames []string, formats []keybase1.AvatarFormat) (res keybase1.LoadAvatarsRes, err error) {
	defer s.G().Trace("SimpleSource.LoadUsers", func() error { return err })()
	apiRes, err := s.apiReq(ctx, "image/username_pic_lookups", "usernames", usernames, formats)
	if err != nil {
		return res, err
	}
	if err = s.makeRes(&res, apiRes, usernames); err != nil {
		return res, err
	}
	return res, nil
}

func (s *SimpleSource) LoadTeams(ctx context.Context, teams []string, formats []keybase1.AvatarFormat) (res keybase1.LoadAvatarsRes, err error) {
	defer s.G().Trace("SimpleSource.LoadTeams", func() error { return err })()
	apiRes, err := s.apiReq(ctx, "image/team_avatar_lookups", "team_names", teams, formats)
	if err != nil {
		return res, err
	}
	if err = s.makeRes(&res, apiRes, teams); err != nil {
		return res, err
	}
	return res, nil
}

func (s *SimpleSource) ClearCacheForName(ctx context.Context, name string, formats []keybase1.AvatarFormat) (err error) {
	return nil
}
