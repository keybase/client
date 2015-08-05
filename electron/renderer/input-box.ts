import _ = require('underscore');
import configuration = require('./lib/configuration');
import React = require('react');
import TypedReact = require('typed-react');

const D = React.DOM;

interface InputBoxProps {
  submit: (text: string) => void;
}

class InputBox extends TypedReact.Component<InputBoxProps, {}> {
  componentDidMount() {
    window.addEventListener('click', this.focus);
  }

  render() {
    return (
      D.div({id: 'input-box'},
        D.form({onSubmit: this.submit},
          D.input({ref: 'input', type: 'text'})
        )
      )
    );
  }

/*
  shouldComponentUpdate(nextProps: InputBoxProps): boolean {
    let input = React.findDOMNode<HTMLInputElement>(this.refs['input']);
    return !(<any>input).matches(':focus');
  }
 */

  submit(e: React.FormEvent) {
    e.preventDefault();
    let input = React.findDOMNode<HTMLInputElement>(this.refs['input']);
    let inputValue = input.value;
    if (inputValue.length > 0) {
      this.props.submit(inputValue);
    }
    input.value = '';
  }

  focus() {
    let input = React.findDOMNode<HTMLInputElement>(this.refs['input']);
    input.focus();
  }

  blur() {
    let input = React.findDOMNode<HTMLInputElement>(this.refs['input']);
    input.blur();
  }
}

export = React.createFactory(TypedReact.createClass(InputBox));
