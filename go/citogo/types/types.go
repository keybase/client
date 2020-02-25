package types

type Outcome string

const (
	OutcomeSuccess Outcome = "success"
	OutcomeFlake   Outcome = "flake"
	OutcomeFail    Outcome = "fail"
)

func (o Outcome) Abbrv() string {
	switch o {
	case OutcomeSuccess:
		return "PASS"
	case OutcomeFlake:
		return "FLK?"
	case OutcomeFail:
		return "FAIL"
	default:
		return "????"
	}
}

type TestResult struct {
	Outcome  Outcome
	TestName string
	Where    string
	Branch   string

	BuildID  string
	Prefix   string
	BuildURL string
}
