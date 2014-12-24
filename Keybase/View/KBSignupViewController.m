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
@end

@implementation KBSignupViewController

- (IBAction)signUp:(id)sender {
  KBRSignup *signUp = [[KBRSignup alloc] initWithClient:AppDelegate.client];
  [signUp signupWithEmail:self.emailField.stringValue inviteCode:self.inviteCodeField.stringValue passphrase:self.passphraseField.stringValue username:self.usernameField.stringValue completion:^(NSError *error, KBSignupRes *res) {
    if (error) {
      [[NSAlert alertWithError:error] beginSheetModalForWindow:self.view.window completionHandler:nil];
      return;
    }
    
    
    
  }];
}

- (IBAction)login:(id)sender {
  //[self.navigationController popViewControllerAnimated:NO];
  KBLoginViewController *loginViewController = [[KBLoginViewController alloc] initWithNibName:@"KBLogin" bundle:nil];
  [self.navigationController pushViewController:loginViewController animated:YES];
}

@end
