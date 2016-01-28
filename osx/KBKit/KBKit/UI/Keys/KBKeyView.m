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
#import "KBDefines.h"

@interface KBKeyView ()
@property YOVBox *labels;
@property KBPGPTextView *textView;

@property (nonatomic) KBRIdentifyKey *identifyKey;
@end

@implementation KBKeyView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOVBox *topView = [YOVBox box];
  {
    _labels = [YOVBox box:@{@"insets": @(20), @"spacing": @(4)}];
    [topView addSubview:_labels];
    [topView addSubview:[KBBox horizontalLine]];
  }
  [self addSubview:topView];

  _textView = [[KBPGPTextView alloc] init];
  _textView.editable = NO;
  [self addSubview:_textView];

  YOVBox *bottomView = [YOVBox box];
  [bottomView kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  {
    [bottomView addSubview:[KBBox horizontalLine]];
    YOHBox *buttons = [YOHBox box:@{@"insets": @(15), @"spacing": @(10), @"minSize": @"90,0"}];
    {
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
      _closeButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      [rightButtons addSubview:_closeButton];
      [buttons addSubview:rightButtons];
    }
    [bottomView addSubview:buttons];
  }
  [self addSubview:bottomView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_textView top:@[topView] bottom:@[bottomView]];
}

- (void)setIdentifyKey:(KBRIdentifyKey *)identifyKey {
  _identifyKey = identifyKey;

  [_labels kb_removeAllSubviews];

  /*
  KBHeaderLabelView *keyLabel = [[KBHeaderLabelView alloc] init];
  keyLabel.columnWidth = 140;
  [keyLabel setHeader:@"Key ID"];
  if (_identifyKeyId.kid) [keyLabel addText:[KBHexString(_identifyKeyId.kid, @"") uppercaseString] style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByCharWrapping targetBlock:nil];
  [_labels addSubview:keyLabel];
   */

  if (_identifyKey.pgpFingerprint) {
    NSString *description = KBDescriptionForFingerprint(KBHexString(_identifyKey.pgpFingerprint, @""), 20);
    [self addText:description header:@"PGP Fingerprint"];
  }

  _textView.attributedText = nil;
  [self setNeedsLayout];

  [KBActivity setProgressEnabled:YES sender:self];
  [self showPublic:^(NSError *error, KBRKeyInfo *keyInfo) {
    [KBActivity setProgressEnabled:NO sender:self];
    if (error) [KBActivity setError:error sender:self];
    if (keyInfo.desc.length > 0) [self addText:keyInfo.desc header:@"Info"];
  }];
}

- (void)close {
  [_closeButton dispatchButton];
}

- (void)addText:(NSString *)text header:(NSString *)header {
  KBHeaderLabelView *label = [[KBHeaderLabelView alloc] init];
  label.columnWidth = 140;
  label.labelPaddingTop = 2;
  [label setHeader:header];
  if (_identifyKey.pgpFingerprint) [label addText:text style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByWordWrapping targetBlock:nil];
  [_labels addSubview:label];
  [self setNeedsLayout];
}

- (void)showPublic:(void (^)(NSError *error, KBRKeyInfo *keyInfo))completion {
  GHWeakSelf gself = self;
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:self.client];
  KBRPGPQuery *options = [[KBRPGPQuery alloc] init];
  options.query = _identifyKey.KID;
  options.exactMatch = YES;
  [request pgpExportWithOptions:options completion:^(NSError *error, NSArray *keys) {
    // TODO This only works when we are the user being key exported
    KBRKeyInfo *keyInfo = [keys firstObject];
    [gself.textView setText:keyInfo.key style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
    completion(error, keyInfo);
  }];
}

- (void)showSecret:(void (^)(NSError *error, KBRKeyInfo *keyInfo))completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:self.client];
  KBRPGPQuery *options = [[KBRPGPQuery alloc] init];
  options.query = _identifyKey.KID;
  options.exactMatch = YES;
  options.secret = YES;
  GHWeakSelf gself = self;

  [request pgpExportByKIDWithOptions:options completion:^(NSError *error, NSArray *items) {
    KBRKeyInfo *keyInfo = items[0];
    if (keyInfo.key) gself.textView.text = keyInfo.key;
    else if (!error) error = KBMakeError(KBErrorCodeGeneric, @"No secret key");
    completion(error, keyInfo);
  }];
}

- (void)removePGPKey:(dispatch_block_t)completion {
  NSString *kid = _identifyKey.KID;
  [KBAlert yesNoWithTitle:@"Delete PGP Key" description:@"Are you sure you want to remove this PGP Key?" yes:@"Delete" view:self completion:^(BOOL yes) {
    if (yes) {
      KBRRevokeRequest *request = [[KBRRevokeRequest alloc] initWithClient:self.client];
      [request revokeKeyWithKeyID:kid completion:^(NSError *error) {
        [NSNotificationCenter.defaultCenter postNotificationName:KBUserDidChangeNotification object:nil userInfo:nil];
        [self close];
      }];
    } else {
      completion();
    }
  }];
}

@end
