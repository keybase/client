//
//  KBProveInputView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveInputView.h"

#import "KBProveType.h"

@interface KBProveInputView ()
@property KBLabel *header;
@property KBLabel *label;
@end

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

  YOHBox *bottomView = [YOHBox box:@{@"spacing": @(20), @"minSize": @"130,0", @"horizontalAlignment": @"center"}];
  [self addSubview:bottomView];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  [bottomView addSubview:_cancelButton];
  _button = [KBButton buttonWithText:@"Connect" style:KBButtonStylePrimary];
  [bottomView addSubview:_button];


  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    y += [layout centerWithSize:CGSizeMake(240, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.header].size.height + 40;
    
    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.label].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.inputField].size.height + 40;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(0, y, size.width, 0) view:bottomView].size.height + 20;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setProofType:(KBRProofType)proofType {
  _proofType = proofType;
  _inputField.placeholder = nil;
  _label.attributedText = nil;

  NSString *headerText = KBNameForProofType(proofType);
  NSString *labelText = @"";
  NSString *placeholder = @"";
  switch (proofType) {
    case KBRProofTypeTwitter:
      labelText = @"What's your Twitter username?";
      placeholder = @"@username";
      break;
    case KBRProofTypeGithub:
      labelText = @"What's your Github username?";
      placeholder = @"username";
      break;
    case KBRProofTypeReddit:
      labelText = @"What's your Reddit username?";
      placeholder = @"username";
      break;
    case KBRProofTypeCoinbase:
      labelText = @"What's your Coinbase username?";
      placeholder = @"username";
      break;
    case KBRProofTypeHackernews:
      labelText = @"What's your HackerNews username?";
      placeholder = @"username";
      break;
    case KBRProofTypeDns:
      labelText = @"What domain name do you want to add?";
      placeholder = @"yoursite.com";
      break;
    case KBRProofTypeGenericWebSite:
      labelText = @"What website do you want to add?";
      placeholder = @"yoursite.com";
      break;
    case KBRProofTypeKeybase:
      labelText = @"What's your Keybase username?";
      placeholder = @"username";
      break;
    case KBRProofTypeRooter:
      labelText = @"What's your Rooter username?";
      placeholder = @"username";
      break;
    case KBRProofTypeNone:
      break;
  }

  [_header setText:headerText style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [_label setText:labelText font:[KBAppearance.currentAppearance textFont] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  _inputField.placeholder = placeholder;

  [self setNeedsLayout];
}

@end
