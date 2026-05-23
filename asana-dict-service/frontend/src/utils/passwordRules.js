export const buildPasswordRules = (value) => ({
  length: value.length >= 12,
  upper: /[A-Z]/.test(value),
  lower: /[a-z]/.test(value),
  digit: /\d/.test(value),
  special: /[^A-Za-z0-9]/.test(value),
  noSpace: !/\s/.test(value),
});

export const allPasswordRulesOk = (value) =>
  Object.values(buildPasswordRules(value)).every(Boolean);
