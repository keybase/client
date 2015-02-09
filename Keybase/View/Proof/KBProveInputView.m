//
//  KBProveInputView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveInputView.h"

@implementation KBProveInputView

- (void)viewInit {
  [super viewInit];
  _inputField = [[KBTextField alloc] init];
  [self addSubview:_inputField];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _button = [KBButton buttonWithText:@"Connect" style:KBButtonStylePrimary];
  [self addSubview:_button];

  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleLink];
  [self addSubview:_cancelButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    y += [layout centerWithSize:CGSizeMake(240, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.label].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.inputField].size.height + 30;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.button].size.height + 20;
    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.cancelButton].size.height + 20;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setProveType:(KBProveType)proveType {
  _proveType = proveType;
  _inputField.placeholder = nil;
  _label.attributedText = nil;

  switch (proveType) {
    case KBProveTypeTwitter:
      [_label setText:@"What is your Twitter username?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"@username";
      break;
    case KBProveTypeGithub:
      [_label setText:@"What is your Github username?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"username";
      break;
    case KBProveTypeReddit:
      [_label setText:@"What is your Reddit username?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"username";
      break;
    case KBProveTypeCoinbase:
      [_label setText:@"What is your Coinbase username?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"username";
      break;
    case KBProveTypeHackernews:
      [_label setText:@"What is your Hackernews username?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"username";
      break;
    case KBProveTypeDNS:
      [_label setText:@"Do you want to connect your domain name?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"yoursite.com";
      break;
    case KBProveTypeHTTPS:
      [_label setText:@"Do you want to connect your web site?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"yoursite.com";
      break;
    case KBProveTypeUnknown:
      break;
  }
  [self setNeedsLayout];
}

@end
