//
//  KBSecretWordsInputView.m
//  Keybase
//
//  Created by Gabriel on 3/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSecretWordsInputView.h"
#import "AppDelegate.h"

@interface KBSecretWordsInputView ()
@property KBTextField *inputField;
@end

@implementation KBSecretWordsInputView

- (void)viewInit {
  [super viewInit];
  self.backgroundColor = KBAppearance.currentAppearance.backgroundColor;
  
  GHWeakSelf gself = self;

  YOView *contentView = [[YOView alloc] init];
  [self addSubview:contentView];

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Add a Device" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [contentView addSubview:header];

  KBLabel *label = [[KBLabel alloc] init];
  [label setText:@"On another device, you should have been presented with a secret passphrase to type here." style:KBTextStyleDefault];
  [contentView addSubview:label];

  _inputField = [[KBTextField alloc] init];
  _inputField.textField.font = [NSFont systemFontOfSize:20];
  _inputField.textField.usesSingleLineMode = NO;
  _inputField.textField.lineBreakMode = NSLineBreakByWordWrapping;
  _inputField.verticalAlignment = KBVerticalAlignmentBottom;
  [contentView addSubview:_inputField];

  YOView *footerView = [[YOView alloc] init];
  KBButton *button = [KBButton buttonWithText:@"OK" style:KBButtonStylePrimary];
  button.targetBlock = ^{ [gself save]; };
  [button setKeyEquivalent:@"\r"];
  [footerView addSubview:button];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  _cancelButton.targetBlock = ^{ [gself cancel]; };
  [footerView addSubview:_cancelButton];
  footerView.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts layoutForButton:button cancelButton:_cancelButton horizontalAlignment:KBHorizontalAlignmentCenter]];
  [contentView addSubview:footerView];

  YOSelf yself = self;
  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:header].size.height + 20;
    y += [layout centerWithSize:CGSizeMake(400, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:label].size.height + 40;

    y += [layout centerWithSize:CGSizeMake(400, 62) frame:CGRectMake(40, y, size.width - 80, 62) view:yself.inputField].size.height + 40;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:footerView].size.height + 20;

    return CGSizeMake(MIN(480, size.width), y);
  }];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts center:contentView]];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window recalculateKeyViewLoop];
  [self.window makeFirstResponder:_inputField];
}

- (void)cancel {
  self.completion(nil);
}

- (void)save {
  NSString *secretWords = self.inputField.text;

  if ([NSString gh_isBlank:secretWords]) {
    [AppDelegate setError:KBErrorAlert(@"You need to enter something.") sender:_inputField];
    return;
  }

  self.completion(secretWords);
}

@end