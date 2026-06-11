export const BATCH_TICKETS = [
  { title: "Cannot login to account", description: "User cannot login after password reset. Multiple attempts failed with invalid credentials error.", priority: "P2", user_type: "STANDARD" },
  { title: "Billing invoice incorrect", description: "Invoice shows wrong amount, need refund for overcharge on annual subscription.", priority: "P1", user_type: "VIP" },
  { title: "App crashes on startup", description: "Application crashes immediately on launch with error code 0x80004005 on Windows 10.", priority: "P1", user_type: "STANDARD" },
  { title: "Slow dashboard loading", description: "Dashboard takes over 30 seconds to load. Timeout errors appearing in browser console.", priority: "P3", user_type: "STANDARD" },
  { title: "Unable to update profile", description: "Cannot update profile picture or email address. Form submission returns 422 error.", priority: "P2", user_type: "STANDARD" },
  { title: "VIP account access revoked", description: "VIP user lost access to premium features after billing cycle renewal.", priority: "P2", user_type: "VIP" },
  { title: "Password reset email not received", description: "User requested password reset but confirmation email not received after 45 minutes.", priority: "P3", user_type: "STANDARD" },
  { title: "Install fails on Windows 11", description: "Installation wizard fails at 67% with error MSI2045. Cannot install on Windows 11.", priority: "P2", user_type: "STANDARD" },
  { title: "Subscription not working after payment", description: "Payment processed but subscription features still not activated.", priority: "P1", user_type: "VIP" },
  { title: "Error 500 on data export API", description: "Internal server error when calling the data export API endpoint with valid auth token.", priority: "P1", user_type: "STANDARD" },
];

export const ACTION_COLORS = {
  AUTO_RESOLVE: { bg: "rgba(34,197,94,.15)", text: "#22c55e" },
  SUGGEST:      { bg: "rgba(234,179,8,.15)",  text: "#eab308" },
  ESCALATE:     { bg: "rgba(239,68,68,.15)",  text: "#ef4444" },
};

export const RISK_COLORS = {
  LOW:  { bg: "rgba(34,197,94,.15)", text: "#22c55e" },
  HIGH: { bg: "rgba(239,68,68,.15)", text: "#ef4444" },
};
