import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

export default createToolkitAuthPlugin({
  workspaceAppPublicPaths: ["/"],
  // Builder calls this without a session; the link's token authenticates it.
  publicPaths: ["/api/builder-webhook"],
  rootAuth: true,
  marketing: false,
});
