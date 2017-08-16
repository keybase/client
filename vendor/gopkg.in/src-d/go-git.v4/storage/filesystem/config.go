package filesystem

import (
	"io/ioutil"
	"os"

	"gopkg.in/src-d/go-git.v4/config"
	"gopkg.in/src-d/go-git.v4/storage/filesystem/internal/dotgit"
)

type ConfigStorage struct {
	dir *dotgit.DotGit
}

func (c *ConfigStorage) Config() (*config.Config, error) {
	cfg := config.NewConfig()

	f, err := c.dir.Config()
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}

		return nil, err
	}

	defer f.Close()

	b, err := ioutil.ReadAll(f)
	if err != nil {
		return nil, err
	}

	if err := cfg.Unmarshal(b); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *ConfigStorage) SetConfig(cfg *config.Config) error {
	if err := cfg.Validate(); err != nil {
		return err
	}

	f, err := c.dir.ConfigWriter()
	if err != nil {
		return err
	}

	defer f.Close()

	b, err := cfg.Marshal()
	if err != nil {
		return err
	}

	_, err = f.Write(b)
	return err
}
