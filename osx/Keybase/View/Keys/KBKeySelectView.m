//
//  KBKeySelectView.m
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBKeySelectView.h"

#import "KBGPGKeysView.h"
#import "KBButton.h"
#import "AppDelegate.h"

@interface KBKeySelectView ()
@end

@implementation KBKeySelectView

- (void)viewInit {
  [super viewInit];

  self.wantsLayer = YES;
  self.backgroundColor = KBAppearance.currentAppearance.secondaryBackgroundColor;

  _keysView = [[KBGPGKeysView alloc] init];
  [self addSubview:_keysView];

  YONSView *footerView = [[YONSView alloc] init];
//  _pushCheckbox = [KBButton buttonWithText:@"Push encrypted copy to Keybase.io?" style:KBButtonStyleCheckbox alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
//  [footerView addSubview:_pushCheckbox];

  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  [footerView addSubview:_cancelButton];

  _selectButton = [KBButton buttonWithText:@"Select" style:KBButtonStylePrimary];
  [footerView addSubview:_selectButton];

  YOSelf yself = self;
  footerView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGSize footerSize = [yself.selectButton sizeThatFits:size];
    [layout setFrame:CGRectMake(size.width - 280, 0, 130, footerSize.height) view:yself.selectButton];
    [layout setFrame:CGRectMake(size.width - 130, 0, 130, footerSize.height) view:yself.cancelButton];

    //[layout sizeToFitVerticalInFrame:CGRectMake(20, 0, size.width - 340, footerSize.height) view:yself.pushCheckbox];
    return CGSizeMake(size.width, footerSize.height);
  }];
  [self addSubview:footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_keysView topView:nil bottomView:footerView margin:UIEdgeInsetsMake(20, 20, 0, 20) padding:20 maxSize:CGSizeMake(800, 400)]];
}

- (void)setGPGKeys:(NSArray *)GPGKeys completion:(MPRequestCompletion)completion {
  [_keysView setGPGKeys:GPGKeys];
  GHWeakSelf gself = self;
  _selectButton.targetBlock = ^{
    NSString *keyID = [[gself.keysView selectedGPGKey] keyID];
    if (!keyID) {
      [AppDelegate setError:KBMakeError(-1, @"You need to select a key.") sender:gself];
      return;
    }
    //BOOL pushSecret = gself.pushCheckbox.state == NSOnState;

    KBRSelectKeyRes *response = [[KBRSelectKeyRes alloc] init];
    response.keyID = keyID;
    //response.doSecretPush = pushSecret;
    completion(nil, response);
  };

  self.cancelButton.targetBlock = ^{
    // No selection
    KBRSelectKeyRes *response = [[KBRSelectKeyRes alloc] init];
    completion(nil, response);
  };
}

@end
