//
//  KBFileSelectView.m
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFileSelectView.h"

@interface KBFileSelectView ()
@property KBLabel *label;
@property KBTextField *textField;
@property KBButton *browseButton;
@end

@implementation KBFileSelectView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  _label = [KBLabel label];
  _label.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:_label];

  _textField = [[KBTextField alloc] init];
  _textField.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _textField.textField.font = KBAppearance.currentAppearance.textFont;
  _textField.focusView.hidden = YES;
  _textField.insets = UIEdgeInsetsZero;
  [self addSubview:_textField];

  GHWeakSelf gself = self;
  _browseButton = [KBButton buttonWithText:@"Browse" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
  _browseButton.targetBlock = ^{ [gself chooseInput]; };
  [self addSubview:_browseButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {

    if (size.height == 0) size.height = 40;

    CGSize labelSize = [KBText sizeThatFits:size attributedString:yself.label.attributedText];
    CGSize buttonSize = [yself.browseButton sizeThatFits:size];
    CGSize fieldSize = CGSizeMake(size.width - 40 - labelSize.width - buttonSize.width, size.height);

    CGFloat x = 10;
    x += [layout setFrame:CGRectMake(x, 0, labelSize.width, size.height) view:yself.label].size.width + 10;
    x += [layout centerWithSize:fieldSize frame:CGRectMake(x, 10, fieldSize.width, size.height) view:yself.textField].size.width + 10;
    x += [layout centerWithSize:buttonSize frame:CGRectMake(x, 0, buttonSize.width, size.height) view:yself.browseButton].size.width;

    return size;
  }];
}

- (NSString *)path {
  return _textField.text;
}

- (void)setLabelText:(NSString *)labelText {
  [_label setText:labelText style:KBTextStyleDefault];
  [self setNeedsLayout];
}

- (void)chooseInput {
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.prompt = @"OK";
  panel.title = @"Choose a file...";
  panel.allowsMultipleSelection = YES;
  GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      for (NSURL *URL in [panel URLs]) {
        if ([URL isFileURL]) {
          gself.textField.text = URL.path;
        }
      }
    }
  }];
}

@end
