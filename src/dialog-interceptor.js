// Runs in MAIN world at document_start via manifest content_scripts.
// Overrides window.alert and window.confirm BEFORE any page JS executes.
// Dormant by default (passes through). Armed via postMessage from content script.

(function () {
  if (window.__snDialogInterceptorInstalled) return;
  window.__snDialogInterceptorInstalled = true;

  var config = null;

  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "__SN_SET_DIALOG_CONFIG") {
      config = {
        dialogAction: event.data.dialogAction || "ok",
        confirmReturnValue: event.data.confirmReturnValue !== false,
      };
    }
    if (event.data && event.data.type === "__SN_CLEAR_DIALOG_CONFIG") {
      config = null;
    }
  });

  var originalAlert = window.alert;
  var originalConfirm = window.confirm;

  window.alert = function (message) {
    if (config) {
      console.log("[SN Dialog] alert intercepted:", message);
      window.postMessage({
        type: "__SN_DIALOG_INTERCEPTED",
        dialogType: "alert",
        message: String(message || ""),
      }, "*");
      return undefined;
    }
    return originalAlert.apply(this, arguments);
  };

  window.confirm = function (message) {
    if (config) {
      var returnValue = config.confirmReturnValue;
      console.log("[SN Dialog] confirm intercepted:", message, "-> returning", returnValue);
      window.postMessage({
        type: "__SN_DIALOG_INTERCEPTED",
        dialogType: "confirm",
        message: String(message || ""),
        returnValue: returnValue,
      }, "*");
      return returnValue;
    }
    return originalConfirm.apply(this, arguments);
  };
})();
