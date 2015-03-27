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
@property KBLabel *textView;
@property KBScrollView *scrollView;
@end

@implementation KBKeyView

- (void)viewInit {
  [super viewInit];
  self.backgroundColor = KBAppearance.currentAppearance.backgroundColor;

  KBButton *removeButton = [KBButton buttonWithText:@"Remove" style:KBButtonStyleToolbar];
  removeButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
    [self removeKey:completion];
  };
  [self addSubview:removeButton];

  _textView = [[KBLabel alloc] init];
  _textView.selectable = YES;

  _scrollView = [[KBScrollView alloc] init];
  [_scrollView setDocumentView:_textView];
  _scrollView.scrollView.borderType = NSBezelBorder;
  [self addSubview:_scrollView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:yself.labels].size.height + 20;
    y += [layout setFrame:CGRectMake(20, y, size.width - 40, 0) view:removeButton options:YOLayoutOptionsSizeToFit].size.height + 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, size.height - y - 40) view:yself.scrollView].size.height;
    return CGSizeMake(size.width, y);
  }];
}

- (void)setKey:(KBRFOKID *)key {
  [_labels removeFromSuperview];
  _labels = [YOVBox box];
  [self addSubview:_labels];

  KBHeaderLabelView *pgpLabel = [[KBHeaderLabelView alloc] init];
  [pgpLabel setHeader:@"PGP"];
  if (key.pgpFingerprint) [pgpLabel addText:KBHexString(key.pgpFingerprint) targetBlock:nil];
  [_labels addSubview:pgpLabel];

  KBHeaderLabelView *keyLabel = [[KBHeaderLabelView alloc] init];
  [keyLabel setHeader:@"Key ID"];
  if (key.kid) [keyLabel addText:KBHexString(key.kid) targetBlock:nil];
  [_labels addSubview:keyLabel];

  _textView.attributedText = nil;

  [self setNeedsLayout];
}

- (void)removeKey:(KBButtonCompletion)completion {
  [KBAlert yesNoWithTitle:@"Delete PGP Key" description:@"Are you sure you want to remove this PGP Key?" yes:@"Delete" view:self completion:^(BOOL yes) {
    if (yes) {
      KBRMykeyRequest *mykey = [[KBRMykeyRequest alloc] initWithClient:self.client];
      [mykey deletePrimary:completion];
    } else {
      completion(nil);
    }
  }];
}

@end
