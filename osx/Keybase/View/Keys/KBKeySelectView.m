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
@property KBGPGKeysView *keysView;
@property KBButton *selectButton;
@property KBButton *cancelButton;
@end

@implementation KBKeySelectView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  _keysView = [[KBGPGKeysView alloc] init];
  [self addSubview:_keysView];

  YOView *footerView = [YOHBox box:@{@"spacing": @"10", @"minSize": @"130,0", @"horizontalAlignment": @"right"}];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  [footerView addSubview:_cancelButton];
  _selectButton = [KBButton buttonWithText:@"Select" style:KBButtonStylePrimary];
  [footerView addSubview:_selectButton];
  [self addSubview:footerView];

  GHWeakSelf gself = self;
  self.cancelButton.targetBlock = ^{
    // No selection
    KBRSelectKeyRes *response = [[KBRSelectKeyRes alloc] init];
    gself.completion(nil, response);
  };

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
    gself.completion(nil, response);
  };

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_keysView topView:nil bottomView:footerView insets:UIEdgeInsetsMake(20, 20, 20, 20) spacing:20 maxSize:CGSizeMake(800, 400)]];
}

- (void)setGPGKeys:(NSArray *)GPGKeys {
  [_keysView setGPGKeys:GPGKeys];
}

@end
