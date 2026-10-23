// Install hub: address nu:get.apps.khensu.nu. (Never /apps as the product URL.)
export const GET_APPS = 'https://get.apps.khensu.nu';
export const GET_APPS_NU = 'nu:get.apps.khensu.nu';

// The App Store's numeric Apple ID for nu.khensu.ptah, from App Store Connect (App Information > Apple ID).
// Until it is set, links go to the install hub. Apple's badge only shows once the app is on the App Store.
export const APP_STORE_ID = '';
export const APP_STORE_URL = APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}` : GET_APPS;

// The Google Play package listing.
export const GOOGLE_PLAY_ID = '';
export const GOOGLE_PLAY_URL = GOOGLE_PLAY_ID
  ? `https://play.google.com/store/apps/details?id=${GOOGLE_PLAY_ID}`
  : '';
