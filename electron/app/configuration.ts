import _ = require('underscore');
import fs = require('fs');
import path = require('path');
import yaml = require('js-yaml');

const configDir = path.join(__dirname, '../config');
const userConfigPath = path.join(process.env.HOME || process.env.USERPROFILE, '.keybase.yml');

function customize(configs: any, userConfigs: any) {
  if (configs.constructor === Array) {
    return configs.concat(userConfigs);
  } else if (configs.constructor === Object) {
    if (userConfigs.constructor === Object) {
      Object.keys(userConfigs).forEach(key => {
        if (configs[key]) {
          configs[key] = customize(configs[key], userConfigs[key]);
        } else {
          configs[key] = userConfigs[key];
        }
      });
    }
    return configs;
  } else {
    return userConfigs;
  }
}

export function load(): any {
  let configs = fs.readdirSync(configDir)
    .filter(c => c.endsWith('.yml'))
    .reduce((result: any, c) => {
      let ymlContent = fs.readFileSync(path.join(configDir, c)).toString();
      result[path.basename(c, path.extname(c))] = yaml.load(ymlContent);
      return result;
    }, {});

  try {
    let userConfigs = yaml.load(fs.readFileSync(userConfigPath).toString());
    return customize(configs, userConfigs);
  } catch (_) {
    // no or invalid user config
    return configs;
  }
}
