package values

import (
	"flag"
	"os"
	"strings"
)

// IsBool checks if a given value is a bool value, i.e. implements the BoolValued interface
func IsBool(v flag.Value) bool {
	if bf, ok := v.(BoolValued); ok {
		return bf.IsBoolFlag()
	}

	return false
}

// SetFromEnv fills a value from a list of env vars
func SetFromEnv(into flag.Value, envVars string) bool {
	multiValued, isMulti := into.(MultiValued)

	if len(envVars) > 0 {
		for _, ev := range strings.Fields(envVars) {
			v := os.Getenv(ev)
			if len(v) == 0 {
				continue
			}
			if !isMulti {
				if err := into.Set(v); err == nil {
					return true
				}
				continue
			}

			vs := strings.Split(v, ",")
			if err := setMultivalued(multiValued, vs); err == nil {
				return true
			}
		}
	}
	return false
}

func setMultivalued(into MultiValued, values []string) error {
	into.Clear()

	for _, v := range values {
		v = strings.TrimSpace(v)
		if err := into.Set(v); err != nil {
			into.Clear()
			return err
		}
	}

	return nil
}
