//
//  KBPGPKeyView.m
//  Keybase
//
//  Created by Gabriel on 3/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBKeyView.h"

#import "KBHeaderLabelView.h"
#import "KBFormatter.h"
#import "KBKitDefines.h"
#import "KBNotifications.h"

@interface KBKeyView ()
@property YOVBox *labels;
@property KBTextView *textView;

@property KBRFOKID *keyId;
@end

@implementation KBKeyView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  _labels = [YOVBox box:@{@"insets": @(20)}];
  [self addSubview:_labels];

  _textView = [[KBTextView alloc] init];
  _textView.view.editable = NO;
  _textView.view.textContainerInset = CGSizeMake(10, 10);
  _textView.borderType = NSBezelBorder;
  [self addSubview:_textView];

  YOHBox *buttons = [YOHBox box:@{@"insets": @(20), @"spacing": @(40), @"horizontalAlignment": @"right"}];
  [self addSubview:buttons];
  KBButton *removeButton = [KBButton buttonWithText:@"Remove" style:KBButtonStyleDanger options:KBButtonOptionsToolbar];
  removeButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
    [self removePGPKey:completion];
  };
  [buttons addSubview:removeButton];

  _cancelButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
  [buttons addSubview:_cancelButton];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_textView top:@[_labels] bottom:@[buttons] insets:UIEdgeInsetsZero spacing:0];
}

- (void)setKeyId:(KBRFOKID *)keyId editable:(BOOL)editable {
  NSAssert(self.window, @"Not in a window");
  NSAssert(keyId.kid, @"No kid");

  _keyId = keyId;

  [_labels kb_removeAllSubviews];

  KBHeaderLabelView *keyLabel = [[KBHeaderLabelView alloc] init];
  keyLabel.columnWidth = 140;
  [keyLabel setHeader:@"Key ID"];
  if (_keyId.kid) [keyLabel addText:[KBHexString(_keyId.kid, @"") uppercaseString] style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByTruncatingMiddle targetBlock:nil];
  [_labels addSubview:keyLabel];

  KBHeaderLabelView *pgpLabel = [[KBHeaderLabelView alloc] init];
  pgpLabel.columnWidth = 140;
  [pgpLabel setHeader:@"PGP Fingerprint"];
  if (_keyId.pgpFingerprint) [pgpLabel addText:[KBHexString(_keyId.pgpFingerprint, @"") uppercaseString] style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByTruncatingMiddle targetBlock:nil];
  [_labels addSubview:pgpLabel];

  NSString *query = KBHexString(_keyId.kid, nil);

  _textView.attributedText = nil;
  [self setNeedsLayout];

  [KBActivity setProgressEnabled:YES sender:self];
  GHWeakSelf gself = self;
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:self.client];
  [request pgpExportWithSessionID:request.sessionId secret:NO query:query completion:^(NSError *error, NSArray *keys) {
    [KBActivity setProgressEnabled:NO sender:self];
    // TODO This only works when we are the user being key exported
    KBRKeyInfo *keyInfo = [keys firstObject];
    [gself.textView setText:keyInfo.key style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
    [self setNeedsLayout];
  }];
}

- (void)close {
  _cancelButton.targetBlock();
}

- (void)removePGPKey:(KBButtonCompletion)completion {
  NSAssert(_keyId.kid, @"No kid");
  NSData *kid = _keyId.kid;
  [KBAlert yesNoWithTitle:@"Delete PGP Key" description:@"Are you sure you want to remove this PGP Key?" yes:@"Delete" view:self completion:^(BOOL yes) {
    if (yes) {
      KBRRevokeRequest *request = [[KBRRevokeRequest alloc] initWithClient:self.client];
      [request revokeKeyWithSessionID:request.sessionId idKb:KBHexString(kid, nil) completion:^(NSError *error) {
        [NSNotificationCenter.defaultCenter postNotificationName:KBUserDidChangeNotification object:nil userInfo:nil];
        [self close];
      }];
    } else {
      completion(nil);
    }
  }];
}

@end
