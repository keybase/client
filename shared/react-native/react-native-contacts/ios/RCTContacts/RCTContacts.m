#import <AddressBook/AddressBook.h>
#import <UIKit/UIKit.h>
#import "RCTContacts.h"
#import <Contacts/Contacts.h>
#import <AssetsLibrary/AssetsLibrary.h>

@implementation RCTContacts {
    CNContactStore * contactStore;
}

RCT_EXPORT_MODULE();

- (NSDictionary *)constantsToExport
{
    return @{
             @"PERMISSION_DENIED": @"denied",
             @"PERMISSION_AUTHORIZED": @"authorized",
             @"PERMISSION_UNDEFINED": @"undefined"
             };
}

RCT_EXPORT_METHOD(checkPermission:(RCTResponseSenderBlock) callback)
{
    CNAuthorizationStatus authStatus = [CNContactStore authorizationStatusForEntityType:CNEntityTypeContacts];
    if (authStatus == CNAuthorizationStatusDenied || authStatus == CNAuthorizationStatusRestricted){
        callback(@[[NSNull null], @"denied"]);
    } else if (authStatus == CNAuthorizationStatusAuthorized){
        callback(@[[NSNull null], @"authorized"]);
    } else {
        callback(@[[NSNull null], @"undefined"]);
    }
}

RCT_EXPORT_METHOD(requestPermission:(RCTResponseSenderBlock) callback)
{
    CNContactStore* contactStore = [[CNContactStore alloc] init];

    [contactStore requestAccessForEntityType:CNEntityTypeContacts completionHandler:^(BOOL granted, NSError * _Nullable error) {
        [self checkPermission:callback];
    }];
}

RCT_EXPORT_METHOD(getContactsMatchingString:(NSString *)string callback:(RCTResponseSenderBlock) callback)
{
    CNContactStore *contactStore = [[CNContactStore alloc] init];
    if (!contactStore)
        return;
    [self getContactsFromAddressBook:contactStore matchingString:string callback:callback];
}

-(void) getContactsFromAddressBook:(CNContactStore *)store
                    matchingString:(NSString *)searchString
                       callback:(RCTResponseSenderBlock)callback
{
    NSMutableArray *contacts = [[NSMutableArray alloc] init];
    NSError *contactError = nil;
    NSArray *keys = @[
                      CNContactEmailAddressesKey,
                      CNContactPhoneNumbersKey,
                      CNContactFamilyNameKey,
                      CNContactGivenNameKey,
                      CNContactMiddleNameKey,
                      CNContactPostalAddressesKey,
                      CNContactOrganizationNameKey,
                      CNContactJobTitleKey,
                      CNContactImageDataAvailableKey
                      ];
    NSArray *arrayOfContacts = [store unifiedContactsMatchingPredicate:[CNContact predicateForContactsMatchingName:searchString]
                                                           keysToFetch:keys
                                                                 error:&contactError];
    [arrayOfContacts enumerateObjectsUsingBlock:^(CNContact * _Nonnull obj, NSUInteger idx, BOOL * _Nonnull stop) {
        NSDictionary *contactDictionary = [self contactToDictionary:obj withThumbnails:NO];
        [contacts addObject:contactDictionary];
    }];
    callback(@[[NSNull null], contacts]);
}

-(void) getAllContacts:(RCTResponseSenderBlock) callback
        withThumbnails:(BOOL) withThumbnails
{
    CNContactStore* contactStore = [self contactsStore:callback];
    if(!contactStore)
        return;

    [self retrieveContactsFromAddressBook:contactStore withThumbnails:withThumbnails withCallback:callback];
}

RCT_EXPORT_METHOD(getAll:(RCTResponseSenderBlock) callback)
{
    [self getAllContacts:callback withThumbnails:true];
}

RCT_EXPORT_METHOD(getAllWithoutPhotos:(RCTResponseSenderBlock) callback)
{
    [self getAllContacts:callback withThumbnails:false];
}

-(void) retrieveContactsFromAddressBook:(CNContactStore*)contactStore
                         withThumbnails:(BOOL) withThumbnails
                           withCallback:(RCTResponseSenderBlock) callback
{
    NSMutableArray *contacts = [[NSMutableArray alloc] init];

    NSError* contactError;
    [contactStore containersMatchingPredicate:[CNContainer predicateForContainersWithIdentifiers: @[contactStore.defaultContainerIdentifier]] error:&contactError];


    NSMutableArray *keysToFetch = [[NSMutableArray alloc]init];
    [keysToFetch addObjectsFromArray:@[
                                       CNContactEmailAddressesKey,
                                       CNContactPhoneNumbersKey,
                                       CNContactFamilyNameKey,
                                       CNContactGivenNameKey,
                                       CNContactMiddleNameKey,
                                       CNContactPostalAddressesKey,
                                       CNContactOrganizationNameKey,
                                       CNContactJobTitleKey,
                                       CNContactImageDataAvailableKey
                                       ]];

    if(withThumbnails) {
        [keysToFetch addObject:CNContactThumbnailImageDataKey];
    }

    CNContactFetchRequest * request = [[CNContactFetchRequest alloc]initWithKeysToFetch:keysToFetch];
    BOOL success = [contactStore enumerateContactsWithFetchRequest:request error:&contactError usingBlock:^(CNContact * __nonnull contact, BOOL * __nonnull stop){
        NSDictionary *contactDict = [self contactToDictionary: contact withThumbnails:withThumbnails];
        [contacts addObject:contactDict];
    }];

    callback(@[[NSNull null], contacts]);
}

-(NSDictionary*) contactToDictionary:(CNContact *) person
                      withThumbnails:(BOOL)withThumbnails
{
    NSMutableDictionary* output = [NSMutableDictionary dictionary];

    NSString *recordID = person.identifier;
    NSString *givenName = person.givenName;
    NSString *familyName = person.familyName;
    NSString *middleName = person.middleName;
    NSString *company = person.organizationName;
    NSString *jobTitle = person.jobTitle;

    [output setObject:recordID forKey: @"recordID"];

    if (givenName) {
        [output setObject: (givenName) ? givenName : @"" forKey:@"givenName"];
    }

    if (familyName) {
        [output setObject: (familyName) ? familyName : @"" forKey:@"familyName"];
    }

    if(middleName){
        [output setObject: (middleName) ? middleName : @"" forKey:@"middleName"];
    }

    if(company){
        [output setObject: (company) ? company : @"" forKey:@"company"];
    }

    if(jobTitle){
        [output setObject: (jobTitle) ? jobTitle : @"" forKey:@"jobTitle"];
    }

    //handle phone numbers
    NSMutableArray *phoneNumbers = [[NSMutableArray alloc] init];

    for (CNLabeledValue<CNPhoneNumber*>* labeledValue in person.phoneNumbers) {
        NSMutableDictionary* phone = [NSMutableDictionary dictionary];
        NSString * label = [CNLabeledValue localizedStringForLabel:[labeledValue label]];
        NSString* value = [[labeledValue value] stringValue];

        if(value) {
            if(!label) {
                label = [CNLabeledValue localizedStringForLabel:@"other"];
            }
            [phone setObject: value forKey:@"number"];
            [phone setObject: label forKey:@"label"];
            [phoneNumbers addObject:phone];
        }
    }

    [output setObject: phoneNumbers forKey:@"phoneNumbers"];
    //end phone numbers

    //handle emails
    NSMutableArray *emailAddreses = [[NSMutableArray alloc] init];

    for (CNLabeledValue<NSString*>* labeledValue in person.emailAddresses) {
        NSMutableDictionary* email = [NSMutableDictionary dictionary];
        NSString* label = [CNLabeledValue localizedStringForLabel:[labeledValue label]];
        NSString* value = [labeledValue value];

        if(value) {
            if(!label) {
                label = [CNLabeledValue localizedStringForLabel:@"other"];
            }
            [email setObject: value forKey:@"email"];
            [email setObject: label forKey:@"label"];
            [emailAddreses addObject:email];
        } else {
            NSLog(@"ignoring blank email");
        }
    }

    [output setObject: emailAddreses forKey:@"emailAddresses"];
    //end emails

    //handle postal addresses
    NSMutableArray *postalAddresses = [[NSMutableArray alloc] init];

    for (CNLabeledValue<CNPostalAddress*>* labeledValue in person.postalAddresses) {
        CNPostalAddress* postalAddress = labeledValue.value;
        NSMutableDictionary* address = [NSMutableDictionary dictionary];

        NSString* street = postalAddress.street;
        if(street){
            [address setObject:street forKey:@"street"];
        }
        NSString* city = postalAddress.city;
        if(city){
            [address setObject:city forKey:@"city"];
        }
        NSString* state = postalAddress.state;
        if(state){
            [address setObject:state forKey:@"state"];
        }
        NSString* region = postalAddress.state;
        if(region){
            [address setObject:region forKey:@"region"];
        }
        NSString* postCode = postalAddress.postalCode;
        if(postCode){
            [address setObject:postCode forKey:@"postCode"];
        }
        NSString* country = postalAddress.country;
        if(country){
            [address setObject:country forKey:@"country"];
        }

        NSString* label = [CNLabeledValue localizedStringForLabel:labeledValue.label];
        if(label) {
            [address setObject:label forKey:@"label"];

            [postalAddresses addObject:address];
        }
    }

    [output setObject:postalAddresses forKey:@"postalAddresses"];
    //end postal addresses

    [output setValue:[NSNumber numberWithBool:person.imageDataAvailable] forKey:@"hasThumbnail"];
    if (withThumbnails) {
        [output setObject:[self getFilePathForThumbnailImage:person recordID:recordID] forKey:@"thumbnailPath"];
    }

    return output;
}

- (NSString *)thumbnailFilePath:(NSString *)recordID
{
    NSString *filename = [recordID stringByReplacingOccurrencesOfString:@":ABPerson" withString:@""];
    NSString* filepath = [NSString stringWithFormat:@"%@/rncontacts_%@.png", [self getPathForDirectory:NSCachesDirectory], filename];
    return filepath;
}

-(NSString *) getFilePathForThumbnailImage:(CNContact*) contact recordID:(NSString*) recordID
{
    NSString *filepath = [self thumbnailFilePath:recordID];

    if([[NSFileManager defaultManager] fileExistsAtPath:filepath]) {
        return filepath;
    }

    if (contact.imageDataAvailable){
        NSData *contactImageData = contact.thumbnailImageData;

        BOOL success = [[NSFileManager defaultManager] createFileAtPath:filepath contents:contactImageData attributes:nil];

        if (!success) {
            NSLog(@"Unable to copy image");
            return @"";
        }

        return filepath;
    }

    return @"";
}

- (NSString *)getPathForDirectory:(int)directory
{
    NSArray *paths = NSSearchPathForDirectoriesInDomains(directory, NSUserDomainMask, YES);
    return [paths firstObject];
}

RCT_EXPORT_METHOD(getPhotoForId:(nonnull NSString *)recordID callback:(RCTResponseSenderBlock)callback)
{
    CNContactStore* contactStore = [self contactsStore:callback];
    if(!contactStore)
        return;

    CNEntityType entityType = CNEntityTypeContacts;
    if([CNContactStore authorizationStatusForEntityType:entityType] == CNAuthorizationStatusNotDetermined)
    {
        [contactStore requestAccessForEntityType:entityType completionHandler:^(BOOL granted, NSError * _Nullable error) {
            if(granted){
                callback(@[[NSNull null], [self getFilePathForThumbnailImage:recordID addressBook:contactStore]]);
            }
        }];
    }
    else if( [CNContactStore authorizationStatusForEntityType:entityType]== CNAuthorizationStatusAuthorized)
    {
        callback(@[[NSNull null], [self getFilePathForThumbnailImage:recordID addressBook:contactStore]]);
    }
}

-(NSString *) getFilePathForThumbnailImage:(NSString *)recordID
                               addressBook:(CNContactStore*)addressBook
{
    NSString *filepath = [self thumbnailFilePath:recordID];

    if([[NSFileManager defaultManager] fileExistsAtPath:filepath]) {
        return filepath;
    }

    NSError* contactError;
    NSArray * keysToFetch =@[CNContactThumbnailImageDataKey, CNContactImageDataAvailableKey];
    CNContact* contact = [addressBook unifiedContactWithIdentifier:recordID keysToFetch:keysToFetch error:&contactError];

    return [self getFilePathForThumbnailImage:contact recordID:recordID];
}


RCT_EXPORT_METHOD(addContact:(NSDictionary *)contactData callback:(RCTResponseSenderBlock)callback)
{
    CNContactStore* contactStore = [self contactsStore:callback];
    if(!contactStore)
        return;

    CNMutableContact * contact = [[CNMutableContact alloc] init];

    [self updateRecord:contact withData:contactData];

    @try {
        CNSaveRequest *request = [[CNSaveRequest alloc] init];
        [request addContact:contact toContainerWithIdentifier:nil];

        [contactStore executeSaveRequest:request error:nil];

        NSDictionary *contactDict = [self contactToDictionary:contact withThumbnails:false];

        callback(@[[NSNull null], contactDict]);
    }
    @catch (NSException *exception) {
        callback(@[[exception description], [NSNull null]]);
    }
}

RCT_EXPORT_METHOD(updateContact:(NSDictionary *)contactData callback:(RCTResponseSenderBlock)callback)
{
    CNContactStore* contactStore = [self contactsStore:callback];
    if(!contactStore)
        return;

    NSError* contactError;
    NSString* recordID = [contactData valueForKey:@"recordID"];
    NSArray * keysToFetch =@[
                             CNContactEmailAddressesKey,
                             CNContactPhoneNumbersKey,
                             CNContactFamilyNameKey,
                             CNContactGivenNameKey,
                             CNContactMiddleNameKey,
                             CNContactPostalAddressesKey,
                             CNContactOrganizationNameKey,
                             CNContactJobTitleKey,
                             CNContactImageDataAvailableKey,
                             CNContactThumbnailImageDataKey,
                             CNContactImageDataKey
                             ];

    @try {
        CNMutableContact* record = [[contactStore unifiedContactWithIdentifier:recordID keysToFetch:keysToFetch error:&contactError] mutableCopy];
        [self updateRecord:record withData:contactData];
        CNSaveRequest *request = [[CNSaveRequest alloc] init];
        [request updateContact:record];

        [contactStore executeSaveRequest:request error:nil];

        NSDictionary *contactDict = [self contactToDictionary:record withThumbnails:false];

        callback(@[[NSNull null], contactDict]);
    }
    @catch (NSException *exception) {
        callback(@[[exception description], [NSNull null]]);
    }
}

-(void) updateRecord:(CNMutableContact *)contact withData:(NSDictionary *)contactData
{
    NSString *givenName = [contactData valueForKey:@"givenName"];
    NSString *familyName = [contactData valueForKey:@"familyName"];
    NSString *middleName = [contactData valueForKey:@"middleName"];
    NSString *company = [contactData valueForKey:@"company"];
    NSString *jobTitle = [contactData valueForKey:@"jobTitle"];

    contact.givenName = givenName;
    contact.familyName = familyName;
    contact.middleName = middleName;
    contact.organizationName = company;
    contact.jobTitle = jobTitle;

    NSMutableArray *phoneNumbers = [[NSMutableArray alloc]init];

    for (id phoneData in [contactData valueForKey:@"phoneNumbers"]) {
        NSString *label = [phoneData valueForKey:@"label"];
        NSString *number = [phoneData valueForKey:@"number"];

        CNLabeledValue *phone;
        if ([label isEqual: @"main"]){
            phone = [[CNLabeledValue alloc] initWithLabel:CNLabelPhoneNumberMain value:[[CNPhoneNumber alloc] initWithStringValue:number]];
        }
        else if ([label isEqual: @"mobile"]){
            phone = [[CNLabeledValue alloc] initWithLabel:CNLabelPhoneNumberMobile value:[[CNPhoneNumber alloc] initWithStringValue:number]];
        }
        else if ([label isEqual: @"iPhone"]){
            phone = [[CNLabeledValue alloc] initWithLabel:CNLabelPhoneNumberiPhone value:[[CNPhoneNumber alloc] initWithStringValue:number]];
        }
        else{
            phone = [[CNLabeledValue alloc] initWithLabel:label value:[[CNPhoneNumber alloc] initWithStringValue:number]];
        }

        [phoneNumbers addObject:phone];
    }
    contact.phoneNumbers = phoneNumbers;

    NSMutableArray *emails = [[NSMutableArray alloc]init];

    for (id emailData in [contactData valueForKey:@"emailAddresses"]) {
        NSString *label = [emailData valueForKey:@"label"];
        NSString *email = [emailData valueForKey:@"email"];

        if(label && email) {
            [emails addObject:[[CNLabeledValue alloc] initWithLabel:label value:email]];
        }
    }

    contact.emailAddresses = emails;

    NSMutableArray *postalAddresses = [[NSMutableArray alloc]init];
    
    for (id addressData in [contactData valueForKey:@"postalAddresses"]) {
        NSString *label = [addressData valueForKey:@"label"];
        NSString *street = [addressData valueForKey:@"street"];
        NSString *postalCode = [addressData valueForKey:@"postalCode"];
        NSString *city = [addressData valueForKey:@"city"];
        NSString *country = [addressData valueForKey:@"country"];
        NSString *state = [addressData valueForKey:@"state"];
        
        if(label && street) {
            CNMutablePostalAddress *postalAddr = [[CNMutablePostalAddress alloc] init];
            postalAddr.street = street;
            postalAddr.postalCode = postalCode;
            postalAddr.city = city;
            postalAddr.country = country;
            postalAddr.state = state;
            [postalAddresses addObject:[[CNLabeledValue alloc] initWithLabel:label value: postalAddr]];
        }
    }
    
    contact.postalAddresses = postalAddresses;

    NSString *thumbnailPath = [contactData valueForKey:@"thumbnailPath"];

    if(thumbnailPath && [thumbnailPath rangeOfString:@"rncontacts_"].location == NSNotFound) {
        contact.imageData = [RCTContacts imageData:thumbnailPath];
    }
}

+ (NSData*) imageData:(NSString*)sourceUri
{
    if([sourceUri hasPrefix:@"assets-library"]){
        return [RCTContacts loadImageAsset:[NSURL URLWithString:sourceUri]];
    } else if ([sourceUri isAbsolutePath]) {
        return [NSData dataWithContentsOfFile:sourceUri];
    } else {
        return [NSData dataWithContentsOfURL:[NSURL URLWithString:sourceUri]];
    }
}

enum { WDASSETURL_PENDINGREADS = 1, WDASSETURL_ALLFINISHED = 0};

+ (NSData*) loadImageAsset:(NSURL*)assetURL {
    //thanks to http://www.codercowboy.com/code-synchronous-alassetlibrary-asset-existence-check/

    __block NSData *data = nil;
    __block NSConditionLock * albumReadLock = [[NSConditionLock alloc] initWithCondition:WDASSETURL_PENDINGREADS];
    //this *MUST* execute on a background thread, ALAssetLibrary tries to use the main thread and will hang if you're on the main thread.
    dispatch_async( dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        ALAssetsLibrary * assetLibrary = [[ALAssetsLibrary alloc] init];
        [assetLibrary assetForURL:assetURL
                      resultBlock:^(ALAsset *asset) {
                          ALAssetRepresentation *rep = [asset defaultRepresentation];

                          Byte *buffer = (Byte*)malloc(rep.size);
                          NSUInteger buffered = [rep getBytes:buffer fromOffset:0.0 length:rep.size error:nil];
                          data = [NSData dataWithBytesNoCopy:buffer length:buffered freeWhenDone:YES];

                          [albumReadLock lock];
                          [albumReadLock unlockWithCondition:WDASSETURL_ALLFINISHED];
                      } failureBlock:^(NSError *error) {
                          NSLog(@"asset error: %@", [error localizedDescription]);

                          [albumReadLock lock];
                          [albumReadLock unlockWithCondition:WDASSETURL_ALLFINISHED];
                      }];
    });

    [albumReadLock lockWhenCondition:WDASSETURL_ALLFINISHED];
    [albumReadLock unlock];

    NSLog(@"asset lookup finished: %@ %@", [assetURL absoluteString], (data ? @"exists" : @"does not exist"));

    return data;
}

RCT_EXPORT_METHOD(deleteContact:(NSDictionary *)contactData callback:(RCTResponseSenderBlock)callback)
{
    if(!contactStore) {
        contactStore = [[CNContactStore alloc] init];
    }

    NSString* recordID = [contactData valueForKey:@"recordID"];

    NSArray *keys = @[CNContactIdentifierKey];
    CNMutableContact *contact = [[contactStore unifiedContactWithIdentifier:recordID keysToFetch:keys error:nil] mutableCopy];
    NSError *error;
    CNSaveRequest *saveRequest = [[CNSaveRequest alloc] init];
    [saveRequest deleteContact:contact];
    [contactStore executeSaveRequest:saveRequest error:&error];

    callback(@[[NSNull null], [NSNull null]]);
}

-(CNContactStore*) contactsStore: (RCTResponseSenderBlock)callback {
    if(!contactStore) {
        CNContactStore* store = [[CNContactStore alloc] init];

        if(!store.defaultContainerIdentifier) {
            NSLog(@"warn - no contact store container id");

            CNAuthorizationStatus authStatus = [CNContactStore authorizationStatusForEntityType:CNEntityTypeContacts];
            if (authStatus == CNAuthorizationStatusDenied || authStatus == CNAuthorizationStatusRestricted){
                callback(@[@"denied", [NSNull null]]);
            } else {
                callback(@[@"undefined", [NSNull null]]);
            }

            return nil;
        }

        contactStore = store;
    }

    return contactStore;
}

@end
