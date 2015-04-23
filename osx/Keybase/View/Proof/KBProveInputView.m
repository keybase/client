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

  _header = [[KBLabel alloc] init];
  [self addSubview:_header];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _inputField = [[KBTextField alloc] init];
  [self addSubview:_inputField];

  _button = [KBButton buttonWithText:@"Connect" style:KBButtonStylePrimary];
  [self addSubview:_button];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleLink];
  [self addSubview:_cancelButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    y += [layout centerWithSize:CGSizeMake(240, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.header].size.height + 40;
    
    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.label].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.inputField].size.height + 40;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.button].size.height + 20;
    
    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.cancelButton].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setProveType:(KBProveType)proveType {
  _proveType = proveType;
  _inputField.placeholder = nil;
  _label.attributedText = nil;

  NSString *headerText = KBNameForProveType(proveType);
  NSString *labelText = @"";
  NSString *placeholder = @"";
  switch (proveType) {
    case KBProveTypeTwitter:
      labelText = @"What is your Twitter username?";
      placeholder = @"@username";
      break;
    case KBProveTypeGithub:
      labelText = @"What is your Github username?";
      placeholder = @"username";
      break;
    case KBProveTypeReddit:
      labelText = @"What is your Reddit username?";
      placeholder = @"username";
      break;
    case KBProveTypeCoinbase:
      labelText = @"What is your Coinbase username?";
      placeholder = @"username";
      break;
    case KBProveTypeHackernews:
      labelText = @"What is your HackerNews username?";
      placeholder = @"username";
      break;
    case KBProveTypeDNS:
      labelText = @"What domain name do you want to add?";
      placeholder = @"yoursite.com";
      break;
    case KBProveTypeHTTPS:
      labelText = @"What website do you want to add?";
      placeholder = @"yoursite.com";
      break;
    case KBProveTypeUnknown:
      break;
  }

  [_header setText:headerText style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [_label setText:labelText font:[KBAppearance.currentAppearance textFont] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  _inputField.placeholder = placeholder;

  [self setNeedsLayout];
}

@end
