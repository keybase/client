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
@property KBTextLabel*titleLabel;
@property KBTextLabel *infoLabel;
@property KBButton *button;
@property KBButton *selectButton;
@end

@implementation KBKeyGenView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  _titleLabel = [[KBTextLabel alloc] init];
  [_titleLabel setText:@"Keybase" textAlignment:NSCenterTextAlignment];
  _titleLabel.font = [NSFont fontWithName:@"Helvetica Neue Thin" size:48];
  [self addSubview:_titleLabel];

  _infoLabel = [[KBTextLabel alloc] init];
  [_infoLabel setText:@"Welcome to keybase.io! You now need to associate a key with your account." textAlignment:NSCenterTextAlignment];
  [self addSubview:_infoLabel];

  _button = [[KBButton alloc] init];
  _button.text = @"Create Key";
  self.button.targetBlock = ^{
    [gself generateKey];
  };
  [self addSubview:_button];

  _selectButton = [KBButton buttonAsLinkWithText:@"I have a key already, let me select it."];
  _selectButton.targetBlock = ^{
    KBTODO(gself);
  };
  [self addSubview:_selectButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 20;
    CGFloat y = 20;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.titleLabel].size.height + 40;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.infoLabel].size.height + 20;

    y += [layout setFrame:CGRectMake(x, y, size.width - x - 20, 48) view:yself.button].size.height + 30;

    y += [layout setFrame:CGRectMake(x, y, size.width - x - 20, 48) view:yself.selectButton].size.height + 30;

    return CGSizeMake(size.width, y);
  }];
}

- (void)generateKey {
  [AppDelegate.sharedDelegate passwordPrompt:@"Your key passphrase" description:@"We'll encrypt your secret key with this password." completion:^(BOOL canceled, NSString *password) {
    [self _generateKey:password];
  }];
}

- (void)_generateKey:(NSString *)password {
  GHWeakSelf gself = self;

  NSString *username = AppDelegate.sharedDelegate.status.user.username;
  NSAssert(username, @"No username");

  // TODO: Should the client do this automatically (by default)?
  KBPgpIdentity *identity = [[KBPgpIdentity alloc] init];
  identity.username = NSStringWithFormat(@"keybase.io/%@", username);
  identity.email = NSStringWithFormat(@"%@@keybase.io", username);

  [self setInProgress:YES sender:nil];
  KBRMykey *mykey = [[KBRMykey alloc] initWithClient:AppDelegate.client];
  [mykey keyGenDefaultWithIds:@[identity] pushPublic:YES pushSecret:NO passphrase:password completion:^(NSError *error) {
    [gself setInProgress:NO sender:nil];
    if (error) {
      [[NSAlert alertWithError:error] beginSheetModalForWindow:gself.window completionHandler:nil];
      return;
    }

    [AppDelegate.sharedDelegate.windowController showTwitterConnect:YES];
  }];
}

@end
