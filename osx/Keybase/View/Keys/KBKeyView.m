//
//  KBPGPKeyView.m
//  Keybase
//
//  Created by Gabriel on 3/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBKeyView.h"

#import "KBHeaderLabelView.h"
#import "KBAppDefines.h"

@interface KBKeyView ()
@property YOVBox *labels;
@property KBTextView *textView;

@property KBRFOKID *keyId;
@end

@implementation KBKeyView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  _textView = [[KBTextView alloc] init];
  _textView.view.editable = NO;
  _textView.view.textContainerInset = CGSizeMake(10, 10);
  _textView.borderType = NSBezelBorder;
  [self addSubview:_textView];

  KBButton *removeButton = [KBButton buttonWithText:@"Remove" style:KBButtonStyleToolbar];
  removeButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
    [self removePGPKey:completion];
  };
  [self addSubview:removeButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:yself.labels].size.height + 20;
    y += [layout setFrame:CGRectMake(20, y, size.width - 40, size.height - y - 40) view:yself.textView].size.height;
    return CGSizeMake(size.width, y);
  }];
}

- (void)setKeyId:(KBRFOKID *)keyId editable:(BOOL)editable {
  NSAssert(self.window, @"No in a window");

  _keyId = keyId;
  [_labels removeFromSuperview];
  _labels = [YOVBox box];
  [self addSubview:_labels];

  KBHeaderLabelView *keyLabel = [[KBHeaderLabelView alloc] init];
  [keyLabel setHeader:@"Key ID"];
  if (_keyId.kid) [keyLabel addText:[KBHexString(_keyId.kid, @"") uppercaseString] style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByTruncatingMiddle targetBlock:nil];
  [_labels addSubview:keyLabel];

  KBHeaderLabelView *pgpLabel = [[KBHeaderLabelView alloc] init];
  [pgpLabel setHeader:@"PGP Fingerprint"];
  if (_keyId.pgpFingerprint) [pgpLabel addText:[KBHexString(_keyId.pgpFingerprint, @"") uppercaseString] style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByTruncatingMiddle targetBlock:nil];
  [_labels addSubview:pgpLabel];

  NSString *query = KBHexString(_keyId.pgpFingerprint, @"");
  if (_keyId.kid) query = KBHexString(_keyId.kid, @"");

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

- (void)removePGPKey:(KBButtonCompletion)completion {
  if (_keyId.kid) {
    [self removePGPKey:KBHexString(_keyId.kid, @"") completion:completion];
  } else {
    completion(KBMakeErrorWithRecovery(-1, @"Oops, can't delete this key.", @"It doesn't have a kid."));
  }
}

- (void)removePGPKey:(NSString *)identifier completion:(KBButtonCompletion)completion {
  [KBAlert yesNoWithTitle:@"Delete PGP Key" description:@"Are you sure you want to remove this PGP Key?" yes:@"Delete" view:self completion:^(BOOL yes) {
    if (yes) {
      KBRRevokeRequest *request = [[KBRRevokeRequest alloc] initWithClient:self.client];
      [request revokeKeyWithSessionID:request.sessionId idKb:identifier completion:completion];
    } else {
      completion(nil);
    }
  }];
}

@end
