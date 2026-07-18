"use client";

import { createContext, useContext } from "react";

export type ActiveProfileOption = { id: string; name: string; niche: string | null };

export type ActiveProfileValue = {
  activeProfileId: string | null;
  profiles: ActiveProfileOption[];
};

const ActiveProfileContext = createContext<ActiveProfileValue>({
  activeProfileId: null,
  profiles: [],
});

export function ActiveProfileProvider({
  value,
  children,
}: {
  value: ActiveProfileValue;
  children: React.ReactNode;
}) {
  return <ActiveProfileContext.Provider value={value}>{children}</ActiveProfileContext.Provider>;
}

export function useActiveProfile() {
  return useContext(ActiveProfileContext);
}
