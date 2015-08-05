import _ = require('underscore');
import Log = require('./lib/log');
//import moment = require('moment');
import React = require('react');
import TypedReact = require('typed-react');

const D = React.DOM;

interface LogContentProps {
  log: Log;
}

class LogContent extends TypedReact.Component<LogContentProps, {}> {
  render() {
    return (
      D.div(null,
        D.div({className: 'info'}
        ),
        D.div(null,
          D.div({className: 'text'}, this.textNode())
        )
      )
    );
  }

  textNode(): React.ReactElement<any>[] {
    let lines = this.props.log.text.split("\n").map(line => {
      return line;
    });

    return lines.reduce((result, line, idx) => {
      if (idx === lines.length - 1) {
        return result.concat(line);
      } else {
        return result.concat([line, D.br()]);
      }
    }, []);
  }

  processSpace(text: string): string {
    return text.replace(/ /g, '\u00A0');
  }

}

export = React.createFactory(TypedReact.createClass(LogContent));
