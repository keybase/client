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

@interface KBLoginViewController ()
@property (weak) IBOutlet NSTextField *emailField;
@property (weak) IBOutlet NSTextField *passphraseField;
@property (weak) IBOutlet NSButton *signupButton;
@end

@implementation KBLoginViewController

- (void)awakeFromNib {
  [KBOLookAndFeel applyLinkStyle:self.signupButton];
}

- (IBAction)login:(id)sender {
  KBRLogin *login = [[KBRLogin alloc] initWithClient:AppDelegate.client];
  [login passphraseLoginWithPassphrase:self.passphraseField.stringValue completion:^(NSError *error, KBLoginRes *loginRes) {
    if (error) {
      [[NSAlert alertWithError:error] beginSheetModalForWindow:self.view.window completionHandler:nil];
      return;
    }
    
  }];
}

- (IBAction)signup:(id)sender {
  CATransition *transition = [CATransition animation];
  [transition setType:kCATransitionFade];
  
  KBSignupViewController *signUpViewController = [[KBSignupViewController alloc] initWithNibName:@"KBSignup" bundle:nil];
  [self.navigationController pushViewController:signUpViewController usingTransition:transition withTransactionBlock:nil];
}

@end

