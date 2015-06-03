//
//  KBSecretPromptView.m
//  Keybase
//
//  Created by Gabriel on 6/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSecretPromptView.h"

@interface KBSecretPromptView ()
@property KBLabel *header;
@property KBLabel *label;
@property KBLabel *errorLabel;
@property KBSecureTextField *inputField;
@property KBButton *button;
@property KBButton *cancelButton;
@end

@implementation KBSecretPromptView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOVBox *contentView = [YOVBox box:@{@"insets": @"10,80,10,80"}];
  [self addSubview:contentView];

  _header = [[KBLabel alloc] init];
  [contentView addSubview:_header];
  [contentView addSubview:[YOBox spacing:CGSizeMake(0, 30)]];

  _label = [[KBLabel alloc] init];
  _label.selectable = YES;
  _label.identifier = @"label";
  [contentView addSubview:_label];
  [contentView addSubview:[YOBox spacing:CGSizeMake(0, 20)]];

  _errorLabel = [[KBLabel alloc] init];
  _errorLabel.selectable = YES;
  [contentView addSubview:_errorLabel];
  [contentView addSubview:[YOBox spacing:CGSizeMake(0, 20)]];

  _inputField = [[KBSecureTextField alloc] init];
  _inputField.identifier = @"input";
  [contentView addSubview:_inputField];
  [contentView addSubview:[YOBox spacing:CGSizeMake(0, 40)]];

  GHWeakSelf gself = self;
  YOHBox *bottomView = [YOHBox box:@{@"spacing": @(20), @"minSize": @"130,0", @"horizontalAlignment": @"center"}];
  [contentView addSubview:bottomView];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  _cancelButton.targetBlock = ^{ [gself closeWithPassword:nil]; };
  [bottomView addSubview:_cancelButton];

  _button = [KBButton buttonWithText:@"OK" style:KBButtonStylePrimary];
  _button.targetBlock = ^{ [gself closeWithPassword:gself.inputField.text]; };
  [_button setKeyEquivalent:@"\r"];
  [bottomView addSubview:_button];

  self.viewLayout = [YOLayout center:contentView];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window recalculateKeyViewLoop];
  [self.window makeFirstResponder:_inputField];
}

- (KBWindow *)openInWindow:(KBWindow *)window {
  return [window addModalWindowForView:self rect:CGRectMake(0, 0, 620, 420)];
}

- (void)closeWithPassword:(NSString *)password {
  [self.window close];
  self.completion(password);
}

- (void)setHeader:(NSString *)header info:(NSString *)info details:(NSString *)details previousError:(NSString *)previousError {
  [_header setText:header style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [_label setText:info font:[KBAppearance.currentAppearance textFont] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];

  [_errorLabel setText:previousError style:KBTextStyleDefault options:KBTextOptionsDanger alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  
  [self setNeedsLayout];
}

@end
