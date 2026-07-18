/** Central TanStack Query key factory. */
export const qk = {
  profiles: ["profiles"] as const,
  profile: (id: string) => ["profile", id] as const,
  activeProfile: ["active-profile"] as const,
  products: (profileId: string) => ["products", profileId] as const,
  winningAds: (profileId: string, filters?: unknown) =>
    ["winning-ads", profileId, filters ?? null] as const,
  generations: (profileId: string) => ["generations", profileId] as const,
  generation: (id: string) => ["generation", id] as const,
  job: (id: string) => ["job", id] as const,
  runningJobs: (profileId: string) => ["running-jobs", profileId] as const,
  usage: ["usage"] as const,
  voices: ["tts-voices"] as const,
};
