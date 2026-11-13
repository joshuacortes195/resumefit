import { ExtError } from "@/lib/ext-auth";
import { featureFlags } from "@/lib/data/settings";

// stops an auto apply request when the admin has switched the feature off for everyone
export async function requireAutoApply(): Promise<void> {
  if (!(await featureFlags()).autoApply) throw new ExtError("Auto Apply is switched off for now.", 403);
}
