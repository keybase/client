//
//  KBKeyGenView.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBKeyGenView.h"
#import "AppDelegate.h"
#import "KBAppKit.h"
#import "KBRPC.h"

@interface KBKeyGenView ()
//@property KBProgressOverlayView *progressView;
@property KBLabel *infoLabel;

//@property KBButton *pushPublicCheckbox;
@property KBButton *pushPrivateCheckbox;
@property KBButton *button;
@end

@implementation KBKeyGenView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  _infoLabel = [[KBLabel alloc] init];
  [_infoLabel setText:@"You are about to discover a new key pair. Your computer will hunt for big prime numbers. It could take anywhere from a few seconds to many minutes." style:KBLabelStyleDefault appearance:KBAppearance.currentAppearance alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [self addSubview:_infoLabel];

//  _progressView = [[KBProgressOverlayView alloc] init];
//  [self addSubview:_progressView];

  /*
   Publish your new public key to Keybase.io (strongly recommended)? [Y/n]

   Keybase can host an encrypted copy of your PGP private key on its servers.
   It can only be decrypted with your passphrase, which Keybase never knows.

   Push an encrypted copy of your private key to Keybase.io? [Y/n]
   */

  //_pushPublicCheckbox = [KBButton buttonWithText:@"Publish your new public key to Keybase.io (strongly recommended)?" style:KBButtonStyleCheckbox alignment:NSLeftTextAlignment];
  //[self addSubview:_pushPublicCheckbox];
  _pushPrivateCheckbox = [KBButton buttonWithText:@"Push an encrypted copy to Keybase.io?" style:KBButtonStyleCheckbox alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [self addSubview:_pushPrivateCheckbox];

  _button = [KBButton buttonWithText:@"Create Key" style:KBButtonStylePrimary];
  self.button.targetBlock = ^{
    [gself generateKey];
  };
  [self addSubview:_button];

  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleLink];
  [self addSubview:_cancelButton];


//  _selectButton = [KBButton buttonWithText:@"I have a key already, let me select it." style:KBButtonStyleLink];
//  _selectButton.targetBlock = ^{
//    KBTODO();
//  };
//  [self addSubview:_selectButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 20;
    CGFloat y = 20;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.infoLabel].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.pushPrivateCheckbox].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.button].size.height + 30;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.cancelButton].size.height + 30;

    return CGSizeMake(size.width, y);
  }];
}

- (void)generateKey {
  [KBAlert promptForInputWithTitle:@"Your key passphrase" description:@"We'll encrypt your secret key with this password." secure:YES style:NSInformationalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:self completion:^(NSModalResponse response, NSString *password) {
    if (response == NSAlertFirstButtonReturn) [self _generateKey:password];
  }];
}

- (void)_generateKey:(NSString *)password {
  KBRPgpCreateUids *uids = [[KBRPgpCreateUids alloc] init];
  uids.useDefault = YES;

  [self.navigation setProgressEnabled:YES];
  KBRMykeyRequest *mykey = [[KBRMykeyRequest alloc] initWithClient:self.client];
  BOOL pushSecret = _pushPrivateCheckbox.state == NSOnState;
  [mykey keyGenDefaultWithCreateUids:uids pushPublic:YES pushSecret:pushSecret passphrase:password completion:^(NSError *error) {
    [self.navigation setProgressEnabled:NO];
    if (error) {
      [AppDelegate setError:error sender:self];
      return;
    }
    self.completion();
  }];
}

@end
