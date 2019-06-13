//
//  ConversationViewController.m
//  KeybaseShare
//
//  Created by Michael Maxim on 8/31/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "ConversationViewController.h"
#import "keybase/keybase.h"

@interface ConversationViewController ()
@property UISearchController* searchController;
@property NSArray* unfilteredInboxItems; // the entire inbox
@property NSArray* filteredInboxItems; // inbox items that are filtered by the search bar
@end

@implementation ConversationViewController

- (void)viewDidLoad {
  [super viewDidLoad];
  
  self.preferredContentSize = CGSizeMake(self.view.frame.size.width, 2*self.view.frame.size.height); // expand
  self.searchController = [[UISearchController alloc] initWithSearchResultsController:nil];
  self.searchController.searchResultsUpdater = self;
  self.searchController.hidesNavigationBarDuringPresentation = false;
  self.searchController.dimsBackgroundDuringPresentation = false;
  self.definesPresentationContext = YES;
  [self.tableView setTableHeaderView:self.searchController.searchBar];
  
  // show this spinner on top of the table view until we have parsed the inbox
  UIActivityIndicatorView* av = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleGray];
  [self.view addSubview:av];
  [av setTranslatesAutoresizingMaskIntoConstraints:NO];
  [av setHidesWhenStopped:YES];
  [av bringSubviewToFront:self.view];
  [av startAnimating];
  [self.tableView addConstraints:@[
     [NSLayoutConstraint constraintWithItem:av
                                  attribute:NSLayoutAttributeCenterX
                                  relatedBy:NSLayoutRelationEqual
                                     toItem:self.tableView
                                  attribute:NSLayoutAttributeCenterX
                                 multiplier:1 constant:0],
     [NSLayoutConstraint constraintWithItem:av
                                  attribute:NSLayoutAttributeCenterY
                                  relatedBy:NSLayoutRelationEqual
                                     toItem:self.tableView
                                  attribute:NSLayoutAttributeCenterY
                                 multiplier:1 constant:0]
     ]
   ];
  
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSError* error = NULL;
    [self setUnfilteredInboxItems:[NSArray new]];
    [self setFilteredInboxItems:[NSArray new]];
    NSString* jsonInbox = KeybaseExtensionGetInbox(&error); // returns the inbox in JSON format
    if (jsonInbox == nil) {
      dispatch_async(dispatch_get_main_queue(), ^{
        NSLog(@"failed to get inbox: %@", error);
        [av stopAnimating];
      });
      // just show blank in this case
      return;
    }
    [self parseInbox:jsonInbox];
    dispatch_async(dispatch_get_main_queue(), ^{
      [av stopAnimating];
      [self.tableView reloadData];
    });
  });
}

- (void)parseInbox:(NSString*)jsonInbox {
  NSError *error = nil;
  NSData *data = [jsonInbox dataUsingEncoding:NSUTF8StringEncoding];
  NSArray *items = [NSJSONSerialization JSONObjectWithData:data options: NSJSONReadingMutableContainers error: &error];
  if (!items) {
    NSLog(@"parseInbox: error parsing JSON: %@", error);
  } else {
    [self setUnfilteredInboxItems:items];
    [self setFilteredInboxItems:items];
  }
}

- (void)didReceiveMemoryWarning {
  KeybaseExtensionForceGC();
  [super didReceiveMemoryWarning];
}

#pragma mark - Table view data source

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView {
    return 1;
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
    return [self.filteredInboxItems count];
}

- (NSDictionary*)getItemAtIndex:(NSIndexPath*)indexPath {
  NSInteger index = [indexPath item];
  return self.filteredInboxItems[index];
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
  UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"ConvCell"];
  if (NULL == cell) {
    cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:@"ConvCell"];
  }
  NSDictionary* item = [self getItemAtIndex:indexPath];
  [[cell textLabel] setText:item[@"Name"]];
  return cell;
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
  NSDictionary* conv = [self getItemAtIndex:indexPath];
  [self.delegate convSelected:conv]; // let main view controller know we have something
}

- (void)updateSearchResultsForSearchController:(UISearchController *)searchController {
  NSString* term = [searchController.searchBar.text lowercaseString];
  if ([term length] == 0) {
    // reset on blank search bar
    [self setFilteredInboxItems:self.unfilteredInboxItems];
  } else {
    NSPredicate* pred = [NSPredicate predicateWithBlock:^BOOL(id obj, NSDictionary* bindings) {
      NSDictionary* item = obj;
      return [item[@"Name"] containsString:term];
    }];
    NSArray* filtered = [self.unfilteredInboxItems filteredArrayUsingPredicate:pred];
    [self setFilteredInboxItems:filtered];
  }
  [self.tableView reloadData];
}

@end
