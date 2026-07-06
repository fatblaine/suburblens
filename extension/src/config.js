// SuburbLens extension — global config.
// Change API_BASE here in ONE place; every script reads from it.
//
//   Local dev  : http://localhost:5281   (matches backend launchSettings.json)
//   Production : your deployed API Gateway URL
//                e.g. https://xxxxx.execute-api.ap-southeast-2.amazonaws.com/Prod
const CONFIG = {
  API_BASE: "https://s5120jvyf4.execute-api.ap-southeast-2.amazonaws.com",
};

// Expose to both content scripts and the background service worker.
globalThis.CONFIG = CONFIG;
