export function generateDummyEmail(userEmail) {
  const [short] = userEmail.split("@");

  // our custom domain
  const domain = "bookbyagent.com";

  // return new dummy email
  return `${short}@${domain}`;
}
