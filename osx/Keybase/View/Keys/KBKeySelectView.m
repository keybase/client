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
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;

  _keysView = [[KBGPGKeysView alloc] init];
  [self addSubview:_keysView];

  _pushCheckbox = [KBButton buttonWithText:@"Save to keybase.io" style:KBButtonStyleCheckbox alignment:NSLeftTextAlignment];
  [self addSubview:_pushCheckbox];

  _selectButton = [KBButton buttonWithText:@"Select" style:KBButtonStylePrimary];
  [self addSubview:_selectButton];

  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  [self addSubview:_cancelButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {

    CGSize footerSize = [yself.selectButton sizeThatFits:size];
    [layout setFrame:CGRectMake(size.width - 300, size.height - footerSize.height - 20, 130, footerSize.height) view:yself.selectButton];
    [layout setFrame:CGRectMake(size.width - 150, size.height - footerSize.height - 20, 130, footerSize.height) view:yself.cancelButton];

    [layout setFrame:CGRectMake(20, size.height - footerSize.height - 40, size.width - 40, 40) view:yself.pushCheckbox];
    footerSize.height += 40;

    [layout setFrame:CGRectMake(20, 20, size.width - 40, size.height - footerSize.height - 20) view:yself.keysView];

    return size;
  }];
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
    BOOL pushSecret = gself.pushCheckbox.state == 1;

    KBRSelectKeyRes *response = [[KBRSelectKeyRes alloc] init];
    response.keyID = keyID;
    response.doSecretPush = pushSecret;
    completion(nil, response);
  };

  self.cancelButton.targetBlock = ^{
    // No selection
    KBRSelectKeyRes *response = [[KBRSelectKeyRes alloc] init];
    completion(nil, response);
  };
}

@end
