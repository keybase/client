import React = require('react');

class Log {
  items: string[];
  text: string;

  constructor(items: string[], text: string) {
    this.items = items;
    this.text = text;
  }

  // render(element: React.ReactElement<any>): HTMLDivElement {
  //   let tag = document.createElement('div');
  //   tag.innerHTML = React.renderToStaticMarkup(element);
  //   return <HTMLDivElement>tag.children[0];
  // }
}

export = Log;
