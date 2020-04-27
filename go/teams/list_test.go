package teams

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func newSocialInviteMD(typ keybase1.TeamInviteType, status keybase1.TeamInviteMetadataStatus) validityInput {
	return validityInput{
		md: keybase1.TeamInviteMetadata{
			Invite: keybase1.TeamInvite{
				Type: typ,
			},
			Status: status,
		},
	}
}

// maxUses = nil -> infinite; otherwise finite
func newInvitelinkMD(etime *time.Time, maxUses *int, usedTimes []time.Time, cancelled *time.Time) validityInput {
	userLog := make(map[keybase1.UserVersion][]keybase1.UserLogPoint)
	var usedInvites []keybase1.TeamUsedInviteLogPoint
	for idx, usedTime := range usedTimes {
		uv := keybase1.UserVersion{
			Uid:         keybase1.UID(fmt.Sprintf("fakeuid%d", idx)),
			EldestSeqno: 3,
		}
		// Joined first via some other way
		userLog[uv] = append(userLog[uv], keybase1.UserLogPoint{
			SigMeta: keybase1.SignatureMetadata{
				Time: keybase1.ToTime(usedTime),
			},
		})
		// Then was added by invitelink
		userLog[uv] = append(userLog[uv], keybase1.UserLogPoint{
			SigMeta: keybase1.SignatureMetadata{
				Time: keybase1.ToTime(usedTime),
			},
		})
		usedInvites = append(usedInvites, keybase1.TeamUsedInviteLogPoint{
			Uv:       uv,
			LogPoint: 1,
		})
	}
	invite := keybase1.TeamInvite{
		Type: keybase1.NewTeamInviteTypeDefault(keybase1.TeamInviteCategory_INVITELINK),
	}
	if etime != nil {
		tmp := keybase1.ToUnixTime(*etime)
		invite.Etime = &tmp
	}
	var m keybase1.TeamInviteMaxUses
	if maxUses == nil {
		m = keybase1.TeamMaxUsesInfinite
	} else {
		m, _ = keybase1.NewTeamInviteFiniteUses(*maxUses)
	}
	invite.MaxUses = &m
	status := keybase1.NewTeamInviteMetadataStatusWithActive()
	if cancelled != nil {
		status = keybase1.NewTeamInviteMetadataStatusWithCancelled(keybase1.TeamInviteMetadataCancel{
			TeamSigMeta: keybase1.TeamSignatureMetadata{
				SigMeta: keybase1.SignatureMetadata{
					Time: keybase1.ToTime(*cancelled),
				},
			},
		})
	}
	md := keybase1.TeamInviteMetadata{
		Invite:      invite,
		Status:      status,
		UsedInvites: usedInvites,
	}
	return validityInput{md, userLog}
}

type validityInput struct {
	md      keybase1.TeamInviteMetadata
	userLog map[keybase1.UserVersion][]keybase1.UserLogPoint
}

// Tests go/protocol/keybase1/extras.go:TeamInviteMetadata.ComputeValidity.
// In this test we stub out fields of invites that are not needed/used by ComputeValidity, for
// brevity.
func TestComputeValidity(t *testing.T) {
	now := time.Date(2020, time.January, 10, 14, 0, 0, 0, time.UTC)
	hour := time.Hour
	day := 24 * hour
	week := 7 * day
	month := 4 * week
	year := 12 * month

	intp := func(n int) *int {
		return &n
	}
	timep := func(t time.Time) *time.Time {
		return &t
	}

	var tests = []struct {
		desc string

		now time.Time
		i   validityInput

		expectedIsValid             bool
		expectedValidityDescription string
	}{
		{
			"active twitter",
			now,
			newSocialInviteMD(
				keybase1.NewTeamInviteTypeWithSbs(keybase1.TeamInviteSocialNetwork("twitter")),
				keybase1.NewTeamInviteMetadataStatusWithActive(),
			),
			true,
			"Expires after 1 use",
		},
		{
			"cancelled twitter",
			now,
			newSocialInviteMD(
				keybase1.NewTeamInviteTypeWithSbs(keybase1.TeamInviteSocialNetwork("twitter")),
				keybase1.NewTeamInviteMetadataStatusWithCancelled(keybase1.TeamInviteMetadataCancel{
					TeamSigMeta: keybase1.TeamSignatureMetadata{
						SigMeta: keybase1.SignatureMetadata{
							Time: keybase1.ToTime(now.Add(-2 * week)),
						},
					},
				}),
			),
			false,
			"Cancelled 2 weeks ago",
		},
		{
			"completed twitter",
			now,
			newSocialInviteMD(
				keybase1.NewTeamInviteTypeWithSbs(keybase1.TeamInviteSocialNetwork("twitter")),
				keybase1.NewTeamInviteMetadataStatusWithCompleted(keybase1.TeamInviteMetadataCompleted{
					TeamSigMeta: keybase1.TeamSignatureMetadata{
						SigMeta: keybase1.SignatureMetadata{
							Time: keybase1.ToTime(now.Add(-month)),
						},
					},
				}),
			),
			false,
			"Completed 4 weeks ago",
		},
		{
			"immortal invitelink",
			now,
			newInvitelinkMD(nil, nil, []time.Time{now.Add(-month), now.Add(-week), now, now.Add(day)}, nil),
			true,
			"Does not expire",
		},
		{
			"cancelled immortal invitelink",
			now,
			newInvitelinkMD(nil, nil, []time.Time{now.Add(-month), now.Add(-week), now.Add(-3 * day), now.Add(-day)}, timep(now.Add(-hour))),
			false,
			"Cancelled 1 hour ago",
		},
		{
			"expiring invitelink",
			now,
			newInvitelinkMD(timep(now.Add(12*day)), nil, []time.Time{}, nil),
			true,
			"Expires in 1 week",
		},
		{
			"expiring limited invitelink",
			now,
			newInvitelinkMD(timep(now.Add(1*year+6*month)), intp(2), []time.Time{}, nil),
			true,
			"Expires in 1 year or after 2 uses",
		},
		{
			"limited invitelink",
			now,
			newInvitelinkMD(nil, intp(123), []time.Time{}, nil),
			true,
			"Expires after 123 uses",
		},
		{
			"expired invitelink, no uses",
			now,
			newInvitelinkMD(timep(now.Add(-16*day)), nil, []time.Time{}, nil),
			false,
			"Expired 2 weeks ago",
		},
		{
			"expired invitelink, some uses",
			now,
			newInvitelinkMD(timep(now.Add(-16*day)), nil, []time.Time{now.Add(-month), now.Add(-year)}, nil),
			false,
			"Expired 2 weeks ago",
		},
		{
			"expired invitelink, no uses, then cancelled",
			now,
			newInvitelinkMD(timep(now.Add(-16*day)), nil, []time.Time{}, timep(now.Add(-2*day))),
			false,
			"Cancelled 2 days ago",
		},
		{
			"usedup invitelink one use",
			now,
			newInvitelinkMD(nil, intp(1), []time.Time{now.Add(-month)}, nil),
			false,
			"Expired 4 weeks ago",
		},
		{
			"usedup invitelink multiuse",
			now,
			newInvitelinkMD(nil, intp(3), []time.Time{now.Add(-3 * month), now.Add(-2 * month), now.Add(-3 * day)}, nil),
			false,
			"Expired 3 days ago",
		},
		{
			"usedup invitelink multiuse then cancelled",
			now,
			newInvitelinkMD(nil, intp(3), []time.Time{now.Add(-3 * month), now.Add(-2 * month), now.Add(-3 * day)}, timep(now.Add(-2*hour))),
			false,
			"Cancelled 2 hours ago",
		},
		{
			"expiring partially used invitelink multiuse",
			now,
			newInvitelinkMD(timep(now.Add(3*day)), intp(3), []time.Time{now.Add(-3 * month), now.Add(-3 * day)}, nil),
			true,
			"Expires in 3 days or after 1 use",
		},
		{
			"partially used invitelink multiuse",
			now,
			newInvitelinkMD(nil, intp(3), []time.Time{now.Add(-3 * month), now.Add(-3 * day)}, nil),
			true,
			"Expires after 1 use",
		},
		{
			"expired and usedup invitelink, but the usedup happened first",
			now,
			newInvitelinkMD(timep(now.Add(-5*time.Minute)), intp(2), []time.Time{now.Add(-3 * month), now.Add(-1 * hour)}, nil),
			false,
			// i.e.; it was invalidated because it was used up, not because it later expired
			"Expired 1 hour ago",
		},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.desc, func(t *testing.T) {
			gotIsValid, gotValidityDescription := tt.i.md.ComputeValidity(tt.now, tt.i.userLog)
			require.Equal(t, tt.expectedIsValid, gotIsValid)
			require.Equal(t, tt.expectedValidityDescription, gotValidityDescription)
		})
	}
}
