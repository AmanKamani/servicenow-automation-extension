// Runs in MAIN world at document_start via manifest content_scripts.
// Overrides window.alert, window.confirm, and window.prompt BEFORE any page JS executes.
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
        promptReturnValue: event.data.promptReturnValue != null ? String(event.data.promptReturnValue) : "",
      };
    }
    if (event.data && event.data.type === "__SN_CLEAR_DIALOG_CONFIG") {
      config = null;
    }
  });

  var originalAlert = window.alert;
  var originalConfirm = window.confirm;
  var originalPrompt = window.prompt;

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

  window.prompt = function (message, defaultValue) {
    if (config) {
      var returnValue = config.promptReturnValue;
      console.log("[SN Dialog] prompt intercepted:", message, "-> returning", returnValue);
      window.postMessage({
        type: "__SN_DIALOG_INTERCEPTED",
        dialogType: "prompt",
        message: String(message || ""),
        returnValue: returnValue,
      }, "*");
      return returnValue;
    }
    return originalPrompt.apply(this, arguments);
  };
})();
