//
//  KBFileSelectView.m
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFileSelectView.h"

@implementation KBFileSelectView

- (void)viewInit {
  [super viewInit];

  _label = [KBLabel label];
  _label.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:_label];

  _textField = [[KBTextField alloc] init];
  _textField.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _textField.textField.font = [NSFont systemFontOfSize:16];
  _textField.focusView.hidden = YES;
  [self addSubview:_textField];

  _browseButton = [KBButton buttonWithText:@"Browse" style:KBButtonStyleToolbar];
  [self addSubview:_browseButton];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_textField leftView:_label rightView:_browseButton insets:UIEdgeInsetsMake(10, 10, 10, 10) spacing:10]];
}

@end
