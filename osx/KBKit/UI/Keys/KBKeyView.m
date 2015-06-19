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
#import "KBNotifications.h"
#import "KBPGPTextView.h"

@interface KBKeyView ()
@property YOVBox *labels;
@property KBPGPTextView *textView;

@property KBRFOKID *keyId;
@end

@implementation KBKeyView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  _labels = [YOVBox box:@{@"insets": @(20), @"spacing": @(4)}];
  [self addSubview:_labels];

  _textView = [[KBPGPTextView alloc] init];
  _textView.editable = NO;
  _textView.borderType = NSBezelBorder;
  [self addSubview:_textView];

  YOHBox *buttons = [YOHBox box:@{@"insets": @(20), @"spacing": @(20), @"minSize": @"90,0"}];
  [self addSubview:buttons];

  KBButton *exportButton = [KBButton buttonWithText:@"Show Secret" style:KBButtonStyleDefault options:KBButtonOptionsToolbar|KBButtonOptionsToggle];
  exportButton.dispatchBlock = ^(KBButton *button, dispatch_block_t completion) {
    if (button.state == NSOnState) {
      [self showSecret:^(NSError *error, KBRKeyInfo *keyInfo) {
        if (error) {
          [KBActivity setError:error sender:self];
          button.state = NSOffState;
          completion();
        } else {
          [button changeText:@"Hide Secret" style:KBButtonStyleDefault];
          completion();
        }
      }];
    } else {
      [self showPublic:^(NSError *error, KBRKeyInfo *keyInfo) {
        if (error) {
          [KBActivity setError:error sender:self];
          button.state = NSOnState;
          completion();
        } else {
          [button changeText:@"Show Secret" style:KBButtonStyleDefault];
          completion();
        }
      }];
    }
  };
  [buttons addSubview:exportButton];

  KBButton *removeButton = [KBButton buttonWithText:@"Remove" style:KBButtonStyleDanger options:KBButtonOptionsToolbar];
  removeButton.dispatchBlock = ^(KBButton *button, dispatch_block_t completion) { [self removePGPKey:completion]; };
  [buttons addSubview:removeButton];

  YOHBox *rightButtons = [YOHBox box:@{@"spacing": @(10), @"horizontalAlignment": @"right", @"minSize": @"90,0"}];
  _cancelButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
  [rightButtons addSubview:_cancelButton];
  [buttons addSubview:rightButtons];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_textView top:@[_labels] bottom:@[buttons]];
}

- (void)setKeyId:(KBRFOKID *)keyId editable:(BOOL)editable {
  NSAssert(self.window, @"Not in a window");
  NSAssert(keyId.kid, @"No kid");

  _keyId = keyId;

  [_labels kb_removeAllSubviews];

  /*
  KBHeaderLabelView *keyLabel = [[KBHeaderLabelView alloc] init];
  keyLabel.columnWidth = 140;
  [keyLabel setHeader:@"Key ID"];
  if (_keyId.kid) [keyLabel addText:[KBHexString(_keyId.kid, @"") uppercaseString] style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByCharWrapping targetBlock:nil];
  [_labels addSubview:keyLabel];
   */

  if (_keyId.pgpFingerprint) {
    KBHeaderLabelView *pgpLabel = [[KBHeaderLabelView alloc] init];
    pgpLabel.columnWidth = 140;
    [pgpLabel setHeader:@"PGP Fingerprint"];
    if (_keyId.pgpFingerprint) [pgpLabel addText:[KBHexString(_keyId.pgpFingerprint, @"") uppercaseString] style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByCharWrapping targetBlock:nil];
    [_labels addSubview:pgpLabel];
  }

  _textView.attributedText = nil;
  [self setNeedsLayout];

  [KBActivity setProgressEnabled:YES sender:self];
  [self showPublic:^(NSError *error, KBRKeyInfo *keyInfo) {
    [KBActivity setProgressEnabled:NO sender:self];
    if (error) [KBActivity setError:error sender:self];
    if (keyInfo.desc.length > 0) [self addDescription:keyInfo.desc];
  }];
}

- (void)close {
  _cancelButton.targetBlock();
}

- (void)addDescription:(NSString *)desc {
  KBHeaderLabelView *label = [[KBHeaderLabelView alloc] init];
  label.columnWidth = 140;
  [label setHeader:@"Description"];
  if (_keyId.pgpFingerprint) [label addText:desc style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByWordWrapping targetBlock:nil];
  [_labels addSubview:label];
  [self setNeedsLayout];
}

- (void)showPublic:(void (^)(NSError *error, KBRKeyInfo *keyInfo))completion {
  GHWeakSelf gself = self;
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:self.client];
  KBRPgpQuery *options = [[KBRPgpQuery alloc] init];
  options.query = KBHexString(_keyId.kid, nil);
  options.exactMatch = YES;
  [request pgpExportWithSessionID:request.sessionId options:options completion:^(NSError *error, NSArray *keys) {
    // TODO This only works when we are the user being key exported
    KBRKeyInfo *keyInfo = [keys firstObject];
    [gself.textView setText:keyInfo.key style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
    completion(error, keyInfo);
  }];
}

- (void)showSecret:(void (^)(NSError *error, KBRKeyInfo *keyInfo))completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:self.client];
  KBRPgpQuery *options = [[KBRPgpQuery alloc] init];
  options.query = KBHexString(_keyId.kid, nil);
  options.exactMatch = YES;
  options.secret = YES;
  GHWeakSelf gself = self;
  [request pgpExportByKIDWithSessionID:request.sessionId options:options completion:^(NSError *error, NSArray *items) {
    KBRKeyInfo *keyInfo = items[0];
    if (keyInfo.key) {
      gself.textView.text = keyInfo.key;
    }
    completion(error, keyInfo);
  }];
}

- (void)removePGPKey:(dispatch_block_t)completion {
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
      completion();
    }
  }];
}

@end
