// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/gregor1/remind.avdl

package gregor1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type GetRemindersArg struct {
	MaxReminders int `codec:"maxReminders" json:"maxReminders"`
}

type DeleteRemindersArg struct {
	ReminderIDs []ReminderID `codec:"reminderIDs" json:"reminderIDs"`
}

type RemindInterface interface {
	// getReminders gets the reminders waiting to be sent out as a batch. Get at most
	// maxReminders back.
	GetReminders(context.Context, int) (ReminderSet, error)
	// deleteReminders deletes all of the reminders by ReminderID
	DeleteReminders(context.Context, []ReminderID) error
}

func RemindProtocol(i RemindInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "gregor.1.remind",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getReminders": {
				MakeArg: func() interface{} {
					var ret [1]GetRemindersArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetRemindersArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetRemindersArg)(nil), args)
						return
					}
					ret, err = i.GetReminders(ctx, typedArgs[0].MaxReminders)
					return
				},
			},
			"deleteReminders": {
				MakeArg: func() interface{} {
					var ret [1]DeleteRemindersArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteRemindersArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteRemindersArg)(nil), args)
						return
					}
					err = i.DeleteReminders(ctx, typedArgs[0].ReminderIDs)
					return
				},
			},
		},
	}
}

type RemindClient struct {
	Cli rpc.GenericClient
}

// getReminders gets the reminders waiting to be sent out as a batch. Get at most
// maxReminders back.
func (c RemindClient) GetReminders(ctx context.Context, maxReminders int) (res ReminderSet, err error) {
	__arg := GetRemindersArg{MaxReminders: maxReminders}
	err = c.Cli.Call(ctx, "gregor.1.remind.getReminders", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// deleteReminders deletes all of the reminders by ReminderID
func (c RemindClient) DeleteReminders(ctx context.Context, reminderIDs []ReminderID) (err error) {
	__arg := DeleteRemindersArg{ReminderIDs: reminderIDs}
	err = c.Cli.Call(ctx, "gregor.1.remind.deleteReminders", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
