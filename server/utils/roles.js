// The four account types. Only an admin can change a role after the account exists.
const ROLES = ["player", "tester", "developer", "admin"];

// What a person may pick when registering (never admin)
const SIGNUP_ROLES = ["player", "tester", "developer"];

// Accounts made before roles existed were stored as "user". They count as players.
const normalize = (role) => (ROLES.includes(role) ? role : "player");

// Uploading games and builds is for developers (and admins)
const canUpload = (user) => !!user && (user.role === "developer" || user.role === "admin");

module.exports = { ROLES, SIGNUP_ROLES, normalize, canUpload };