//
//  KBLoginViewController.m
//  Keybase
//
//  Created by Gabriel on 12/23/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBLoginViewController.h"

#import "KBDefines.h"
#import "AppDelegate.h"
#import "KBSignupViewController.h"
#import "KBRPC.h"
#import "KBKeyGenViewController.h"

@interface KBLoginViewController ()
@property (weak) IBOutlet NSTextField *emailField;
@property (weak) IBOutlet NSTextField *passphraseField;
@property (weak) IBOutlet NSButton *signupButton;
@property (weak) IBOutlet NSButton *loginButton;
@end

@implementation KBLoginViewController

- (void)awakeFromNib {
  [KBOLookAndFeel applyLinkStyle:self.signupButton];
  self.emailField.stringValue = AppDelegate.sharedDelegate.username ? AppDelegate.sharedDelegate.username : @"";
}

- (IBAction)login:(id)sender {
  KBRLogin *login = [[KBRLogin alloc] initWithClient:AppDelegate.client];
  
  NSString *passphrase = self.passphraseField.stringValue;
  [self setInProgress:YES sender:self.loginButton];
  [login passphraseLoginNoIdentifyWithUsername:self.emailField.stringValue passphrase:passphrase completion:^(NSError *error) {
    [self setInProgress:NO sender:self.loginButton];
    if (error) {
      [[NSAlert alertWithError:error] beginSheetModalForWindow:self.view.window completionHandler:nil];
      return;
    }
    
    self.passphraseField.stringValue = @"";

    KBKeyGenViewController *keyGenViewController = [[KBKeyGenViewController alloc] init];
    [self.navigationController pushViewController:keyGenViewController animated:YES];
  }];
}

- (IBAction)signup:(id)sender {
  CATransition *transition = [CATransition animation];
  [transition setType:kCATransitionFade];
  
  KBSignupViewController *signUpViewController = [[KBSignupViewController alloc] init];
  [self.navigationController pushViewController:signUpViewController usingTransition:transition withTransactionBlock:nil];
}

@end

