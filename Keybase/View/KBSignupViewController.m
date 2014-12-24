//
//  KBSignupViewController.m
//  Keybase
//
//  Created by Gabriel on 12/23/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBSignupViewController.h"

#import "KBRPC.h"
#import "AppDelegate.h"
#import "KBLoginViewController.h"

@interface KBSignupViewController ()
@property (weak) IBOutlet NSTextField *emailField;
@property (weak) IBOutlet NSTextField *usernameField;
@property (weak) IBOutlet NSTextField *passphraseField;
@property (weak) IBOutlet NSTextField *inviteCodeField;
@property (weak) IBOutlet NSButton *loginButton;
@end

@implementation KBSignupViewController

- (void)awakeFromNib {
  [KBOLookAndFeel applyLinkStyle:self.loginButton];
}

- (IBAction)signup:(id)sender {
  KBRSignup *signup = [[KBRSignup alloc] initWithClient:AppDelegate.client];
  [signup signupWithEmail:self.emailField.stringValue inviteCode:self.inviteCodeField.stringValue passphrase:self.passphraseField.stringValue username:self.usernameField.stringValue completion:^(NSError *error, KBSignupRes *res) {
    if (error) {
      [[NSAlert alertWithError:error] beginSheetModalForWindow:self.view.window completionHandler:nil];
      return;
    }
    
    
    
  }];
}

- (IBAction)login:(id)sender {
  CATransition *transition = [CATransition animation];
  [transition setType:kCATransitionFade];
  
  KBLoginViewController *loginViewController = [[KBLoginViewController alloc] initWithNibName:@"KBLogin" bundle:nil];
  [self.navigationController pushViewController:loginViewController usingTransition:transition withTransactionBlock:nil];
}

@end
