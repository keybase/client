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
  [_infoLabel setText:@"Welcome to keybase.io! You now need to associate a key with your account." font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSCenterTextAlignment];
  [self addSubview:_infoLabel];

  /*
   Publish your new public key to Keybase.io (strongly recommended)? [Y/n]

   Keybase can host an encrypted copy of your PGP private key on its servers.
   It can only be decrypted with your passphrase, which Keybase never knows.

   Push an encrypted copy of your private key to Keybase.io? [Y/n]
   */

  _button = [KBButton buttonWithText:@"Create Key"];
  self.button.targetBlock = ^{
    [gself generateKey];
  };
  [self addSubview:_button];

  _selectButton = [KBButton buttonWithLinkText:@"I have a key already, let me select it."];
  _selectButton.targetBlock = ^{
    KBTODO(gself);
  };
  [self addSubview:_selectButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 20;
    CGFloat y = 20;

    y += [layout centerWithSize:CGSizeMake(300, 48) frame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.infoLabel].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(200, 48) frame:CGRectMake(x, y, size.width - x - 20, 48) view:yself.button].size.height + 30;

    y += [layout setFrame:CGRectMake(x, y, size.width - x - 20, 48) view:yself.selectButton].size.height + 30;

    return CGSizeMake(size.width, y);
  }];
}

- (void)generateKey {
  [AppDelegate passwordPrompt:@"Your key passphrase" description:@"We'll encrypt your secret key with this password." view:self completion:^(BOOL canceled, NSString *password) {
    [self _generateKey:password];
  }];
}

- (void)_generateKey:(NSString *)password {
  GHWeakSelf gself = self;

  KBRPgpCreateUids *uids = [[KBRPgpCreateUids alloc] init];
  uids.useDefault = YES;

  [self setProgressIndicatorEnabled:YES];
  KBRMykeyRequest *mykey = [[KBRMykeyRequest alloc] initWithClient:AppDelegate.client];
  [mykey keyGenDefaultWithCreateUids:uids pushPublic:YES pushSecret:YES passphrase:password completion:^(NSError *error) {
    [gself setProgressIndicatorEnabled:NO];
    if (error) {
      [self setError:error];
      return;
    }

    [AppDelegate.sharedDelegate.windowController showTwitterConnect:YES];
  }];
}

@end
