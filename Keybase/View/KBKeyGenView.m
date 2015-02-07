//
//  KBKeyGenView.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBKeyGenView.h"
#import "AppDelegate.h"
#import "KBUIDefines.h"
#import "KBRPC.h"

@interface KBKeyGenView ()
@property KBLabel *infoLabel;
@property KBButton *button;
@property KBButton *selectButton;
@end

@implementation KBKeyGenView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  _infoLabel = [[KBLabel alloc] init];
  [_infoLabel setText:@" " font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSCenterTextAlignment];
  [self addSubview:_infoLabel];

  /*
   Publish your new public key to Keybase.io (strongly recommended)? [Y/n]

   Keybase can host an encrypted copy of your PGP private key on its servers.
   It can only be decrypted with your passphrase, which Keybase never knows.

   Push an encrypted copy of your private key to Keybase.io? [Y/n]
   */

  _button = [KBButton buttonWithText:@"Create Key" style:KBButtonStylePrimary];
  self.button.targetBlock = ^{
    [gself generateKey];
  };
  [self addSubview:_button];

  _selectButton = [KBButton buttonWithText:@"I have a key already, let me select it." style:KBButtonStyleLink];
  _selectButton.targetBlock = ^{
    KBTODO();
  };
  [self addSubview:_selectButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 20;
    CGFloat y = 20;

    y += [layout centerWithSize:CGSizeMake(300, 48) frame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.infoLabel].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(x, y, size.width - x - 20, 48) view:yself.button].size.height + 30;

    y += [layout centerWithSize:CGSizeMake(0, 0) frame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.selectButton].size.height + 30;

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

  //[self setProgressIndicatorEnabled:YES];
  [AppDelegate setInProgress:YES view:self];
  KBRMykeyRequest *mykey = [[KBRMykeyRequest alloc] initWithClient:AppDelegate.client];
  [mykey keyGenDefaultWithCreateUids:uids pushPublic:YES pushSecret:YES passphrase:password completion:^(NSError *error) {
    [AppDelegate setInProgress:NO view:self];
    if (error) {
      [AppDelegate setError:error sender:self];
      return;
    }

  }];
}

@end
