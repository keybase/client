//
//  KBSecretPromptView.m
//  Keybase
//
//  Created by Gabriel on 6/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSecretPromptView.h"

#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBSecretPromptView ()
@property KBLabel *header;
@property KBLabel *label;
@property KBLabel *detailsLabel;
@property KBLabel *errorLabel;
@property KBSecureTextField *inputField;
@property KBButton *button;
@property KBButton *cancelButton;
@end

@implementation KBSecretPromptView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOVBox *contentView = [YOVBox box:@{@"insets": @"10,80,10,80", @"spacing": @(30)}];
  {
    _header = [[KBLabel alloc] init];
    [contentView addSubview:_header];

    YOVBox *labels = [YOVBox box:@{@"spacing": @(20)}];
    labels.ignoreLayoutForHidden = YES;
    {
      _label = [[KBLabel alloc] init];
      _label.selectable = YES;
      [labels addSubview:_label];

      _detailsLabel = [[KBLabel alloc] init];
      _detailsLabel.selectable = YES;
      [labels addSubview:_detailsLabel];

      _errorLabel = [[KBLabel alloc] init];
      _errorLabel.selectable = YES;
      [labels addSubview:_errorLabel];
    }
    [contentView addSubview:labels];

    _inputField = [[KBSecureTextField alloc] init];
    [contentView addSubview:_inputField];

    GHWeakSelf gself = self;
    YOHBox *bottomView = [YOHBox box:@{@"spacing": @(20), @"minSize": @"130,0", @"horizontalAlignment": @"center"}];
    {
      _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
      _cancelButton.targetBlock = ^{ [gself closeWithPassword:nil]; };
      [bottomView addSubview:_cancelButton];

      _button = [KBButton buttonWithText:@"OK" style:KBButtonStylePrimary];
      _button.targetBlock = ^{ [gself closeWithPassword:gself.inputField.text]; };
      [_button setKeyEquivalent:@"\r"];
      [bottomView addSubview:_button];
    }
    [contentView addSubview:bottomView];
  }
  [self addSubview:contentView];

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

  if (info.length > 0) {
    [_label setText:info style:KBTextStyleDefault options:0 alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByClipping];
    _label.hidden = NO;
  } else {
    _label.hidden = YES;
  }

  if (details.length > 0) {
    [_detailsLabel setText:details style:KBTextStyleDefault options:0 alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
    _detailsLabel.hidden = NO;
  } else {
    _detailsLabel.hidden = YES;
  }

  if (previousError.length > 0) {
    [_errorLabel setText:previousError style:KBTextStyleDefault options:KBTextOptionsDanger alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
    _errorLabel.hidden = NO;
  } else {
    _errorLabel.hidden = YES;
  }
  
  [self setNeedsLayout];
}

@end
