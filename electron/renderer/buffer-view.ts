import _ = require('underscore');
import Log = require('./lib/log');
import React = require('react');
import TypedReact = require('typed-react');

const D = React.DOM;

const followLogBuffer = 20;
const minimumScrollHeight = 10;

interface BufferViewProps {
  log: Log;
}

interface BufferViewState {}

class BufferView extends TypedReact.Component<BufferViewProps, BufferViewState> {
  isFollowingLog: boolean;

  constructor() {
    super();
    this.isFollowingLog = true;
  }

  getInitialState(): BufferViewState {
    return {
      log: new Log([], '')
    };
  }

  view(): HTMLDivElement {
    return React.findDOMNode<HTMLDivElement>(this.refs['view']);
  }

  componentDidMount() {}

  logElement(text: string): React.ReactElement<any> {
    let className = 'log';
    return (
      D.li({className},
        D.pre(null, text)
      )
     );

  }

  componentWillUpdate(nextProps: BufferViewProps) {
    let view = this.view();
    let isAtBottom = view.scrollHeight - view.clientHeight - view.scrollTop < followLogBuffer;
    this.isFollowingLog = isAtBottom;
  }

  render() {
    return (
      D.div({id: 'buffer-view', ref: 'view'},
        D.ul(null, this.props.log.items.map(this.logElement))
      )
    );
  }

  componentDidUpdate() {
    if (this.isFollowingLog) {
      let view = this.view();
      view.scrollTop = view.scrollHeight;
    }
  }

  scrollDown() {
    let view = this.view();
    let logs = _.toArray<HTMLLIElement>(view.getElementsByTagName('li'));

    let logToScroll = null;
    for (let i = 0; i < logs.length; i++) {
      let log = logs[i];
      if (log.offsetTop < view.scrollTop - minimumScrollHeight) {
        logToScroll = log;
      } else {
        break;
      }
    }
    let scrollTop = logToScroll ? logToScroll.offsetTop : 0;
    view.scrollTop = scrollTop;
  }

  scrollUp() {
    let view = this.view();
    let logs = _.toArray<HTMLLIElement>(view.getElementsByTagName('li'));

    let logToScroll = null;
    for (let i = 0; i < logs.length; i++) {
      let log = logs[i];
      if (log.offsetTop > view.scrollTop + minimumScrollHeight) {
        logToScroll = log;
        break;
      }
    }
    let scrollTop = logToScroll ? logToScroll.offsetTop : 0;
    view.scrollTop = scrollTop;
  }

  scrollTop() {
    let view = this.view();
    view.scrollTop = 0;
  }

  scrollBottom() {
    let view = this.view();
    view.scrollTop = view.scrollHeight;
  }

  pageDown() {
    let view = this.view();
    view.scrollTop = view.scrollTop + view.clientHeight;
  }

  pageUp() {
    let view = this.view();
    view.scrollTop = view.scrollTop - view.clientHeight;
  }

}

export = React.createFactory(TypedReact.createClass(BufferView));
