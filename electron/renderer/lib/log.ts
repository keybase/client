import _ = require('underscore');
import configuration = require('./configuration');
import LogContent = require('../log-content');
import React = require('react');

class Log {
  items: string[];
  text: string;
  //textContent: string;
  //htmlContent: string;

  constructor(items: string[], text: string) {
    this.items = items;
    this.text = text;
    //let content = this.render(LogContent({log: this}));
    //this.htmlContent = content.innerHTML;
    //this.textContent = content.querySelector('.text').textContent;
  }

  render(element: React.ReactElement<any>): HTMLDivElement {
    let tag = document.createElement('div');
    tag.innerHTML = React.renderToStaticMarkup(element);
    return <HTMLDivElement>tag.children[0];
  }
}

export = Log;
