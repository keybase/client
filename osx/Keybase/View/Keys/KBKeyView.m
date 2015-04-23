//
//  KBPGPKeyView.m
//  Keybase
//
//  Created by Gabriel on 3/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBKeyView.h"

#import "KBHeaderLabelView.h"
#import "KBDefines.h"

@interface KBKeyView ()
@property YOVBox *labels;
@property KBTextView *textView;
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

  /*
  KBButton *removeButton = [KBButton buttonWithText:@"Remove" style:KBButtonStyleToolbar];
  removeButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
    KBDebugAlert(@"Waiting for RPC method to remove pgp key by id", self.window);
    completion(nil);
    //[self removePGPKey:completion];
  };
  [self addSubview:removeButton];
   */

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:yself.labels].size.height + 20;
    y += [layout setFrame:CGRectMake(20, y, size.width - 40, size.height - y - 40) view:yself.textView].size.height;
    return CGSizeMake(size.width, y);
  }];
}

- (void)setKey:(KBRFOKID *)key editable:(BOOL)editable {
  [_labels removeFromSuperview];
  _labels = [YOVBox box];
  [self addSubview:_labels];

  KBHeaderLabelView *keyLabel = [[KBHeaderLabelView alloc] init];
  [keyLabel setHeader:@"Key ID"];
  if (key.kid) [keyLabel addText:KBHexString(key.kid) targetBlock:nil];
  [_labels addSubview:keyLabel];

  KBHeaderLabelView *pgpLabel = [[KBHeaderLabelView alloc] init];
  [pgpLabel setHeader:@"PGP"];
  if (key.pgpFingerprint) [pgpLabel addText:KBHexString(key.pgpFingerprint) targetBlock:nil];
  [_labels addSubview:pgpLabel];

  NSString *query = KBHexString(key.pgpFingerprint);
  if (key.kid) query = KBHexString(key.kid);

  GHWeakSelf gself = self;
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:self.client];
  [request pgpExportWithSessionID:request.sessionId secret:NO query:query completion:^(NSError *error, NSArray *keys) {
    KBRFingerprintAndKey *keyInfo = [keys firstObject];
    [gself.textView setText:keyInfo.key style:KBTextStyleMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  }];

  _textView.attributedText = nil;

  [self setNeedsLayout];
}

- (void)removePGPKey:(KBButtonCompletion)completion {
  [KBAlert yesNoWithTitle:@"Delete PGP Key" description:@"Are you sure you want to remove this PGP Key?" yes:@"Delete" view:self completion:^(BOOL yes) {
    if (yes) {
      KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:self.client];
      [request pgpDeletePrimary:completion];
    } else {
      completion(nil);
    }
  }];
}

@end
